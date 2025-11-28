# app.py - BACKEND DE GESTÃO DE FROTAS
import json
import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

# ====================================
# CONFIGURAÇÃO INICIAL
# ====================================
app = Flask(__name__)
CORS(app)  # Habilita CORS para todas as rotas
ARQUIVO_JSON = 'gastos_veiculos.json'

# ====================================
# FUNÇÕES DE UTILIDADE E PERSISTÊNCIA
# ====================================
def carregar_dados():
    """Carrega dados do arquivo JSON e garante as chaves necessárias"""
    if os.path.exists(ARQUIVO_JSON):
        try:
            with open(ARQUIVO_JSON, 'r', encoding='utf-8') as f:
                dados = json.load(f)
                if 'gastos' not in dados: dados['gastos'] = []
                if 'diarias' not in dados: dados['diarias'] = []
                return dados
        except Exception as e:
            print(f"Erro ao carregar dados: {e}")
            return {'gastos': [], 'diarias': []}
    return {'gastos': [], 'diarias': []}

def salvar_dados(dados):
    """Salva dados no arquivo JSON"""
    try:
        with open(ARQUIVO_JSON, 'w', encoding='utf-8') as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Erro ao salvar dados: {e}")
        return False

def calcular_dias_uteis(data_inicio, data_fim):
    """Calcula dias (total) entre duas datas"""
    try:
        inicio = datetime.strptime(data_inicio, '%Y-%m-%d')
        fim = datetime.strptime(data_fim, '%Y-%m-%d')
        dias = (fim - inicio).days + 1
        return max(1, dias)
    except:
        return 1

def calcular_status_garantia(data_garantia):
    """Calcula status da garantia"""
    if not data_garantia:
        return 'Sem Data'
    try:
        garantia = datetime.strptime(data_garantia, '%Y-%m-%d')
        # Zera hora para comparar apenas a data
        hoje = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) 
        if garantia < hoje:
            return 'Vencida'
        else:
            return 'Vigente'
    except:
        return 'Data Inválida'

def aplicar_filtros(gastos, filtros):
    """
    CORREÇÃO: Filtra a lista de gastos com base nos filtros da requisição (Veículo, Placa, etc.).
    A lógica verifica se o filtro está preenchido ANTES de tentar comparar.
    """
    
    # Remove filtros com valor vazio para não processá-los
    filtros = {k: v for k, v in filtros.items() if v} 

    if not filtros:
        return gastos
    
    gastos_filtrados = []
    
    # Prepara o filtro de mês, garantindo o formato '01', '02', etc.
    mes_filtro = filtros.get('mes').zfill(2) if filtros.get('mes') else None
    
    for gasto in gastos:
        # 1. Filtro por Veículo
        if filtros.get('veiculo') and gasto.get('veiculo') != filtros['veiculo']: 
            continue
        
        # 2. Filtro por Placa
        if filtros.get('placa') and gasto.get('placa') != filtros['placa']: 
            continue
            
        # 3. Filtro por Motorista
        if filtros.get('motorista') and gasto.get('motorista') != filtros['motorista']: 
            continue
            
        # 4. Filtro por Data (Ano e Mês)
        data_gasto = gasto.get('data', '')
        if data_gasto:
            ano = data_gasto[:4]
            mes = data_gasto[5:7] # MM
            
            if filtros.get('ano') and ano != filtros['ano']: 
                continue
                
            if mes_filtro and mes != mes_filtro: 
                continue
        
        # Se o gasto passou por todos os filtros ativos, adicione-o
        gastos_filtrados.append(gasto)
        
    return gastos_filtrados

# ====================================
# ROTAS BASE
# ====================================

@app.route('/')
def home():
    return jsonify({
        'sistema': 'Gestão de Frotas - Backend API',
        'status': 'online',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'online', 
        'message': 'Servidor funcionando!',
        'timestamp': datetime.now().isoformat()
    })
# ... (Removida a rota /api/test, pois não é essencial)

# ====================================
# DASHBOARD
# ====================================

@app.route('/api/dashboard', methods=['GET'])
def dashboard():
    """Dashboard com dados reais do sistema"""
    try:
        dados = carregar_dados()
        gastos = dados.get('gastos', [])
        diarias = dados.get('diarias', [])
        
        # ... (Mantida a lógica de cálculo do dashboard) ...
        
        # Gastos do mês atual
        mes_atual = datetime.now().strftime('%Y-%m')
        gastos_mes = sum(float(g.get('valor', 0)) for g in gastos if g.get('data', '').startswith(mes_atual))
        
        # Diárias do mês atual
        diarias_mes = sum(float(d.get('valor_total', 0)) for d in diarias if d.get('data_inicio', '').startswith(mes_atual))
        
        # Serviços com garantia vencida
        servicos_vencidos = 0
        servicos_sem_garantia = 0
        
        for gasto in gastos:
            if gasto.get('tipo_gasto', '').lower() in ['manutencao', 'manutenção']:
                status = calcular_status_garantia(gasto.get('garantia_validade'))
                
                if status == 'Vencida':
                    servicos_vencidos += 1
                
                if not gasto.get('garantia_validade'):
                    servicos_sem_garantia += 1
        
        # Entidades únicas
        placas_unicas = set(g.get('placa') for g in gastos if g.get('placa'))
        motoristas_unicos = set(g.get('motorista') for g in gastos if g.get('motorista'))
        
        # Totais gerais
        total_gastos = sum(float(g.get('valor', 0)) for g in gastos)
        total_diarias = sum(float(d.get('valor_total', 0)) for d in diarias)
        
        resumo = {
            'total_gastos': round(total_gastos, 2),
            'total_diarias': round(total_diarias, 2),
            'gastos_mes_atual': round(gastos_mes, 2),
            'diarias_mes_atual': round(diarias_mes, 2),
            'servicos_vencidos': servicos_vencidos,
            'servicos_sem_garantia': servicos_sem_garantia,
            'total_veiculos': len(placas_unicas),
            'total_motoristas': len(motoristas_unicos)
        }
        
        alertas = {
            'servicos_vencidos': servicos_vencidos,
            'servicos_sem_garantia': servicos_sem_garantia
        }
        
        return jsonify({
            'status': 'sucesso',
            'dashboard': {
                'resumo': resumo,
                'alertas': alertas
            }
        })
        
    except Exception as e:
        print(f"❌ Erro no dashboard: {e}")
        return jsonify({'status': 'erro', 'mensagem': str(e)}), 500

# ====================================
# SERVIÇOS
# ====================================

@app.route('/api/servicos', methods=['GET'])
def listar_servicos():
    """Lista serviços de manutenção"""
    try:
        dados = carregar_dados()
        gastos = dados.get('gastos', [])
        
        servicos = [g for g in gastos if g.get('tipo_gasto', '').lower() in ['manutencao', 'manutenção']]
        
        for servico in servicos:
            if not servico.get('status_garantia'):
                servico['status_garantia'] = calcular_status_garantia(servico.get('garantia_validade'))
        
        vigentes = sum(1 for s in servicos if s.get('status_garantia') == 'Vigente')
        vencidas = sum(1 for s in servicos if s.get('status_garantia') == 'Vencida')
        
        return jsonify({
            'status': 'sucesso',
            'servicos': servicos,
            'resumo': {
                'total': len(servicos),
                'vigentes': vigentes,
                'vencidas': vencidas,
                'sem_data': sum(1 for s in servicos if not s.get('garantia_validade'))
            }
        })
    except Exception as e:
        return jsonify({'status': 'erro', 'mensagem': str(e)}), 500

# ====================================
# DIÁRIAS
# ====================================

@app.route('/api/diarias', methods=['GET'])
def listar_diarias():
    """Lista diárias"""
    try:
        dados = carregar_dados()
        return jsonify({
            'status': 'sucesso',
            'diarias': dados.get('diarias', [])
        })
    except Exception as e:
        return jsonify({'status': 'erro', 'mensagem': str(e)}), 500

@app.route('/api/diarias', methods=['POST'])
def registrar_diaria():
    """Registra nova diária"""
    try:
        dados = carregar_dados()
        nova_diaria = request.json
        
        campos_obrigatorios = ['motorista', 'data_inicio', 'data_fim', 'valor_diaria_unitaria']
        for campo in campos_obrigatorios:
            if not nova_diaria.get(campo):
                return jsonify({'status': 'erro', 'mensagem': f'Campo {campo} é obrigatório'}), 400
        
        dias = calcular_dias_uteis(nova_diaria['data_inicio'], nova_diaria['data_fim'])
        valor_total = dias * float(nova_diaria['valor_diaria_unitaria'])
        
        diaria_completa = {
            'id': datetime.now().strftime('%Y%m%d%H%M%S'),
            'motorista': nova_diaria['motorista'],
            'data_inicio': nova_diaria['data_inicio'],
            'data_fim': nova_diaria['data_fim'],
            'dias_uteis': dias,
            'valor_diaria_unitaria': float(nova_diaria['valor_diaria_unitaria']),
            'valor_total': valor_total,
            'observacoes': nova_diaria.get('observacoes', ''),
            'data_registro': datetime.now().isoformat()
        }
        
        dados['diarias'].append(diaria_completa)
        salvar_dados(dados)
        
        return jsonify({
            'status': 'sucesso',
            'mensagem': 'Diária registrada com sucesso!',
            'diaria': diaria_completa
        })
    except Exception as e:
        return jsonify({'status': 'erro', 'mensagem': str(e)}), 500

# ====================================
# GASTOS (CRUD)
# ====================================

@app.route('/api/gastos', methods=['GET'])
def listar_gastos():
    """Lista todos os gastos"""
    try:
        dados = carregar_dados()
        return jsonify({
            'status': 'sucesso', 
            'gastos': dados.get('gastos', [])
        })
    except Exception as e:
        return jsonify({'status': 'erro', 'mensagem': str(e)}), 500

@app.route('/api/gastos', methods=['POST'])
def registrar_gasto():
    """Registra novo gasto"""
    try:
        dados = carregar_dados()
        novo_gasto = request.json
        
        campos_obrigatorios = ['veiculo', 'placa', 'motorista', 'tipo_gasto', 'valor', 'data']
        for campo in campos_obrigatorios:
            if not novo_gasto.get(campo):
                return jsonify({'status': 'erro', 'mensagem': f'Campo {campo} é obrigatório'}), 400
        
        novo_id = max([g.get('id', 0) for g in dados['gastos']] + [0]) + 1
        novo_gasto['id'] = novo_id
        novo_gasto['data_registro'] = datetime.now().isoformat()
        
        if novo_gasto.get('garantia_validade'):
            novo_gasto['status_garantia'] = calcular_status_garantia(novo_gasto['garantia_validade'])
        
        dados['gastos'].append(novo_gasto)
        salvar_dados(dados)
        
        return jsonify({
            'status': 'sucesso', 
            'mensagem': 'Gasto registrado com sucesso!',
            'id': novo_id
        })
    except Exception as e:
        return jsonify({'status': 'erro', 'mensagem': str(e)}), 500

@app.route('/api/gastos/<int:id>', methods=['PUT'])
def atualizar_gasto(id):
    """Atualiza gasto existente"""
    try:
        dados = carregar_dados()
        gasto_index = next((i for i, g in enumerate(dados['gastos']) if g.get('id') == id), None)
        
        if gasto_index is None:
            return jsonify({'status': 'erro', 'mensagem': 'Gasto não encontrado'}), 404
        
        dados_atualizados = request.json
        dados_atualizados['id'] = id
        
        if dados_atualizados.get('garantia_validade'):
            dados_atualizados['status_garantia'] = calcular_status_garantia(dados_atualizados['garantia_validade'])
        
        dados['gastos'][gasto_index] = {**dados['gastos'][gasto_index], **dados_atualizados}
        
        salvar_dados(dados)
        return jsonify({'status': 'sucesso', 'mensagem': 'Gasto atualizado com sucesso!'})
    except Exception as e:
        return jsonify({'status': 'erro', 'mensagem': str(e)}), 500

@app.route('/api/gastos/<int:id>', methods=['DELETE'])
def excluir_gasto(id):
    """Exclui gasto"""
    try:
        dados = carregar_dados()
        dados['gastos'] = [g for g in dados['gastos'] if g.get('id') != id]
        salvar_dados(dados)
        return jsonify({'status': 'sucesso', 'mensagem': 'Gasto excluído com sucesso!'})
    except Exception as e:
        return jsonify({'status': 'erro', 'mensagem': str(e)}), 500

# ====================================
# ANÁLISE E FILTROS
# ====================================

@app.route('/api/analise', methods=['GET'])
def analise_dados():
    """Calcula dados para gráficos aplicando filtros da URL."""
    try:
        dados = carregar_dados()
        gastos = dados.get('gastos', [])
        diarias = dados.get('diarias', [])

        # 1. Aplica filtros DA REQUISIÇÃO na lista principal de gastos
        filtros = request.args.to_dict()
        gastos_filtrados = aplicar_filtros(gastos, filtros) 

        # 2. Análise de Gastos (USANDO APENAS A LISTA FILTRADA)
        gastos_por_tipo = {}
        gastos_por_veiculo = {}
        gastos_por_placa = {}
        gastos_mensal = {}

        for gasto in gastos_filtrados: 
            valor = float(gasto.get('valor', 0))
            
            tipo = gasto.get('tipo_gasto', 'Outros')
            gastos_por_tipo[tipo] = gastos_por_tipo.get(tipo, 0) + valor
            
            veiculo = gasto.get('veiculo', 'Não Informado')
            gastos_por_veiculo[veiculo] = gastos_por_veiculo.get(veiculo, 0) + valor
            
            placa = gasto.get('placa', 'Sem Placa')
            gastos_por_placa[placa] = gastos_por_placa.get(placa, 0) + valor
            
            if gasto.get('data'):
                mes_ano = gasto['data'][:7]
                gastos_mensal[mes_ano] = gastos_mensal.get(mes_ano, 0) + valor
        
        # 3. Análise de Diárias (usando lista completa, pois não há filtros de diárias)
        diarias_por_motorista = {}
        diarias_mensal = {}
        for diaria in diarias:
            valor_total = float(diaria.get('valor_total', 0))
            motorista = diaria.get('motorista', 'Não Informado')
            diarias_por_motorista[motorista] = diarias_por_motorista.get(motorista, 0) + valor_total
            if diaria.get('data_inicio'):
                mes_ano = diaria['data_inicio'][:7]
                diarias_mensal[mes_ano] = diarias_mensal.get(mes_ano, 0) + valor_total
        
        return jsonify({
            'status': 'sucesso',
            'analise': {
                'gastos': {
                    'por_tipo': {k: round(v, 2) for k, v in gastos_por_tipo.items()},
                    'por_veiculo': {k: round(v, 2) for k, v in gastos_por_veiculo.items()},
                    'por_placa': {k: round(v, 2) for k, v in gastos_por_placa.items()},
                    'mensal': {k: round(v, 2) for k, v in sorted(gastos_mensal.items())}
                },
                'diarias': {
                    'por_motorista': {k: round(v, 2) for k, v in diarias_por_motorista.items()},
                    'mensal': {k: round(v, 2) for k, v in sorted(diarias_mensal.items())}
                }
            }
        })
    except Exception as e:
        print(f"❌ Erro na análise: {e}")
        return jsonify({'status': 'erro', 'mensagem': str(e)}), 500

@app.route('/api/filtros', methods=['GET'])
def obter_filtros():
    """Opções para filtros (usadas no frontend para preencher selects)"""
    try:
        dados = carregar_dados()
        gastos = dados.get('gastos', [])
        diarias = dados.get('diarias', [])
        
        veiculos = sorted(list(set(g.get('veiculo') for g in gastos if g.get('veiculo'))))
        placas = sorted(list(set(g.get('placa') for g in gastos if g.get('placa'))))
        motoristas_gastos = sorted(list(set(g.get('motorista') for g in gastos if g.get('motorista'))))
        motoristas_diarias = sorted(list(set(d.get('motorista') for d in diarias if d.get('motorista'))))
        
        # Anos disponíveis dos gastos
        anos = sorted(list(set(g['data'][:4] for g in gastos if g.get('data') and len(g['data']) >= 4)), reverse=True)
        
        return jsonify({
            'status': 'sucesso',
            'filtros': {
                'veiculos': veiculos,
                'placas': placas,
                'motoristas_gastos': motoristas_gastos,
                'motoristas_diarias': motoristas_diarias,
                'anos': anos
            }
        })
    except Exception as e:
        return jsonify({'status': 'erro', 'mensagem': str(e)}), 500

# ====================================
# INICIALIZAÇÃO
# ====================================

if __name__ == '__main__':
    # Inicializa com dados de exemplo se necessário
    if not os.path.exists(ARQUIVO_JSON):
        dados_iniciais = {
            'gastos': [
                {
                    'id': 1,
                    'data': '2024-01-15',
                    'veiculo': 'Carro A',
                    'placa': 'ABC-1234',
                    'motorista': 'João Silva',
                    'tipo_gasto': 'Manutencao',
                    'valor': 350.50,
                    'nf_numero': 'NF123456',
                    'os_numero': 'OS789012',
                    'garantia_validade': '2024-07-15',
                    'observacoes': 'Troca de óleo e filtros',
                    'data_registro': '2024-01-15T10:00:00',
                    'status_garantia': calcular_status_garantia('2024-07-15')
                },
                {
                    'id': 2,
                    'data': '2024-01-20',
                    'veiculo': 'Carro B',
                    'placa': 'XYZ-5678',
                    'motorista': 'Maria Santos',
                    'tipo_gasto': 'Combustivel',
                    'valor': 180.00,
                    'observacoes': 'Abastecimento completo',
                    'data_registro': '2024-01-20T14:30:00'
                }
            ],
            'diarias': [
                {
                    'id': '20240115103000',
                    'motorista': 'João Silva',
                    'data_inicio': '2024-01-10',
                    'data_fim': '2024-01-12',
                    'dias_uteis': 3,
                    'valor_diaria_unitaria': 150.00,
                    'valor_total': 450.00,
                    'observacoes': 'Viagem para clientes',
                    'data_registro': '2024-01-10T08:00:00'
                }
            ]
        }
        salvar_dados(dados_iniciais)
        print("📁 Arquivo JSON inicializado com dados de exemplo!")
    
    print("🚀 Servidor Flask rodando na porta 5000!")
    print("📍 http://127.0.0.1:5000")
    print("📊 Dashboard: http://127.0.0.1:5000/api/dashboard")
    app.run(debug=True, host='127.0.0.1', port=5000)