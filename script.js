// Configuração
const API_BASE = 'http://127.0.0.1:5000/api';
let dadosAnalise = {};
let graficos = {};

// Elementos
const elements = {
    dashboard: document.getElementById('dashboard'),
    servicosLista: document.getElementById('servicos-lista'),
    diariasLista: document.getElementById('lista-diarias'),
    forms: {
        gasto: document.getElementById('registro-gasto-form'),
        diaria: document.getElementById('registro-diaria-form')
    }
};

// ===== FUNÇÕES PRINCIPAIS =====

// Sistema de Tabs
function openTab(event, tabName) {
    // Esconde todas as tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostra a tab selecionada
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
    
    // Carrega dados específicos da tab
    if (tabName === 'tab-analise') {
        console.log('📊 Abrindo aba análise...');
        setTimeout(() => {
            carregarAnalise();
        }, 100);
    } else if (tabName === 'tab-diarias') {
        carregarDiarias();
    } else if (tabName === 'tab-servicos') {
        carregarServicos();
    }
}

// ===== DASHBOARD =====
async function carregarDashboard() {
    try {
        console.log('📊 Iniciando carregamento do dashboard...');
        
        const response = await fetch(`${API_BASE}/dashboard`);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📊 Resposta do dashboard:', data);
        
        if (data.status === 'sucesso') {
            const resumo = data.dashboard.resumo;
            const alertas = data.dashboard.alertas;
            
            elements.dashboard.innerHTML = `
                <h2>📊 Dashboard Resumido</h2>
                <div class="dashboard-cards">
                    <div class="card">
                        <h3>Total Gastos</h3>
                        <div class="value">R$ ${resumo.total_gastos.toFixed(2)}</div>
                        <div class="description">Acumulado geral</div>
                    </div>
                    <div class="card">
                        <h3>Total Diárias</h3>
                        <div class="value">R$ ${resumo.total_diarias.toFixed(2)}</div>
                        <div class="description">Valor total em diárias</div>
                    </div>
                    <div class="card">
                        <h3>Gastos Este Mês</h3>
                        <div class="value">R$ ${resumo.gastos_mes_atual.toFixed(2)}</div>
                        <div class="description">${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
                    </div>
                    <div class="card ${alertas.servicos_vencidos > 0 ? 'alert' : 'success'}">
                        <h3>Garantias Vencidas</h3>
                        <div class="value">${alertas.servicos_vencidos}</div>
                        <div class="description">Serviços com garantia expirada</div>
                    </div>
                    <div class="card">
                        <h3>Veículos na Frota</h3>
                        <div class="value">${resumo.total_veiculos}</div>
                        <div class="description">Placas cadastradas</div>
                    </div>
                    <div class="card">
                        <h3>Motoristas</h3>
                        <div class="value">${resumo.total_motoristas}</div>
                        <div class="description">Cadastrados no sistema</div>
                    </div>
                </div>
                
                ${alertas.servicos_vencidos > 0 ? `
                    <div class="alert alert-error" style="margin-top: 20px;">
                        <strong>⚠️ Atenção!</strong> Existem ${alertas.servicos_vencidos} serviços com garantia vencida. 
                        Verifique a aba "Serviços" para mais detalhes.
                    </div>
                ` : ''}
                
                ${alertas.servicos_sem_garantia > 0 ? `
                    <div class="alert alert-warning" style="margin-top: 10px;">
                        <strong>📝 Observação:</strong> ${alertas.servicos_sem_garantia} serviços não possuem data de garantia cadastrada.
                    </div>
                ` : ''}
            `;
            
            console.log('✅ Dashboard carregado com sucesso!');
            
        } else {
            throw new Error(data.mensagem || 'Erro desconhecido no servidor');
        }
        
    } catch (error) {
        console.error('❌ Erro no dashboard:', error);
        elements.dashboard.innerHTML = `
            <div class="alert alert-error">
                <strong>Erro ao carregar dashboard:</strong> ${error.message}
            </div>
        `;
    }
}

// ===== GERENCIAMENTO DE GASTOS =====
elements.forms.gasto.addEventListener('submit', async (e) => {
    e.preventDefault();
    await registrarGasto();
});

async function registrarGasto() {
    const formData = new FormData(elements.forms.gasto);
    const gasto = Object.fromEntries(formData);
    const isEditing = document.getElementById('gasto-id-edicao').value !== '';

    try {
        const url = isEditing 
            ? `${API_BASE}/gastos/${document.getElementById('gasto-id-edicao').value}`
            : `${API_BASE}/gastos`;
        
        const response = await fetch(url, {
            method: isEditing ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gasto)
        });
        
        const result = await response.json();
        
        if (result.status === 'sucesso') {
            showAlert('success', result.mensagem);
            limparFormGasto();
            carregarServicos();
            carregarDashboard();
            if (document.getElementById('tab-analise').classList.contains('active')) {
                carregarAnalise();
            }
        } else {
            showAlert('error', result.mensagem);
        }
    } catch (error) {
        showAlert('error', `Erro ao ${isEditing ? 'editar' : 'registrar'} gasto: ${error.message}`);
    }
}

function limparFormGasto() {
    elements.forms.gasto.reset();
    document.getElementById('gasto-id-edicao').value = '';
    document.getElementById('btn-submit-gasto').textContent = '✅ Registrar Gasto';
    document.querySelector('#tab-gastos legend').textContent = '📝 Registrar Novo Gasto';
}

async function editarGasto(id) {
    try {
        const response = await fetch(`${API_BASE}/gastos`);
        const data = await response.json();
        
        if (data.status === 'sucesso') {
            const gasto = data.gastos.find(g => g.id === id);
            if (gasto) {
                // Preenche o formulário
                Object.keys(gasto).forEach(key => {
                    const element = document.getElementById(key);
                    if (element && gasto[key]) {
                        element.value = gasto[key];
                    }
                });
                
                document.getElementById('gasto-id-edicao').value = id;
                document.getElementById('btn-submit-gasto').textContent = '💾 Salvar Edição';
                document.querySelector('#tab-gastos legend').textContent = `✏️ Editando Gasto ID ${id}`;
                
                // Muda para a tab de gastos
                // NOTA: É necessário passar o event como argumento, ajustei a chamada no HTML
                // Para não quebrar aqui, chamo a função de forma simples e confio na lógica de estado da tab
                // openTab('tab-gastos');
                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                document.getElementById('tab-gastos').classList.add('active');
                document.querySelector('[onclick*="tab-gastos"]').classList.add('active');

            }
        }
    } catch (error) {
        showAlert('error', `Erro ao carregar gasto: ${error.message}`);
    }
}

async function excluirGasto(id) {
    if (confirm(`🗑️ Tem certeza que deseja excluir o gasto ID ${id}?`)) {
        try {
            const response = await fetch(`${API_BASE}/gastos/${id}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.status === 'sucesso') {
                showAlert('success', result.mensagem);
                carregarServicos();
                carregarDashboard();
                if (document.getElementById('tab-analise').classList.contains('active')) {
                    carregarAnalise();
                }
            } else {
                showAlert('error', result.mensagem);
            }
        } catch (error) {
            showAlert('error', `Erro ao excluir gasto: ${error.message}`);
        }
    }
}

// ===== GERENCIAMENTO DE SERVIÇOS =====
async function carregarServicos() {
    try {
        console.log('📡 Carregando serviços...');
        const response = await fetch(`${API_BASE}/servicos`);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'sucesso') {
            renderizarServicos(data.servicos, data.resumo);
        } else {
            elements.servicosLista.innerHTML = `<div class="alert alert-error">${data.mensagem}</div>`;
        }
    } catch (error) {
        console.error('❌ Erro ao carregar serviços:', error);
        elements.servicosLista.innerHTML = `
            <div class="alert alert-error">
                <strong>Erro ao carregar serviços:</strong> ${error.message}
            </div>
        `;
    }
}

function renderizarServicos(servicos, resumo) {
    if (!servicos || servicos.length === 0) {
        elements.servicosLista.innerHTML = '<div class="alert alert-info">Nenhum serviço de manutenção registrado.</div>';
        return;
    }

    let html = `
        <div class="alert alert-info">
            <strong>Resumo:</strong> ${resumo.vigentes} vigentes • ${resumo.vencidas} vencidas • ${resumo.sem_data} sem data
        </div>
        <div class="table-container">
            <table id="tabela-servicos">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Data</th>
                        <th>Veículo</th>
                        <th>Placa</th>
                        <th>Motorista</th>
                        <th>Valor (R$)</th>
                        <th>Nº OS</th>
                        <th>Validade Garantia</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>`;
    
    servicos.forEach(servico => {
        const statusClass = servico.status_garantia === 'Vigente' ? 'status-vigente' : 
                            servico.status_garantia === 'Vencida' ? 'status-vencida' : 'status-sem-data';
        
        html += `
            <tr>
                <td>${servico.id}</td>
                <td>${formatarData(servico.data)}</td>
                <td>${servico.veiculo}</td>
                <td>${servico.placa}</td>
                <td>${servico.motorista}</td>
                <td>R$ ${parseFloat(servico.valor).toFixed(2)}</td>
                <td>${servico.os_numero || '-'}</td>
                <td>${servico.garantia_validade ? formatarData(servico.garantia_validade) : '-'}</td>
                <td><span class="${statusClass}">${servico.status_garantia || 'Sem Data'}</span></td>
                <td>
                    <button class="acoes-btn btn-editar" onclick="editarGasto(${servico.id})">Editar</button>
                    <button class="acoes-btn btn-excluir" onclick="excluirGasto(${servico.id})">Excluir</button>
                </td>
            </tr>`;
    });

    html += '</tbody></table></div>';
    elements.servicosLista.innerHTML = html;
}

// ===== GERENCIAMENTO DE DIÁRIAS =====
elements.forms.diaria.addEventListener('submit', async (e) => {
    e.preventDefault();
    await registrarDiaria();
});

// Cálculo automático de diárias
document.getElementById('data_inicio').addEventListener('change', calcularDiaria);
document.getElementById('data_fim').addEventListener('change', calcularDiaria);
document.getElementById('valor_diaria_unitaria').addEventListener('input', calcularDiaria);

function calcularDiaria() {
    const inicio = document.getElementById('data_inicio').value;
    const fim = document.getElementById('data_fim').value;
    const valorDiaria = parseFloat(document.getElementById('valor_diaria_unitaria').value) || 0;

    if (inicio && fim) {
        // Correção de bug no cálculo de dias: Data Fim - Data Início + 1
        const diffTime = Math.abs(new Date(fim) - new Date(inicio));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const dias = Math.max(1, diffDays);
        const total = dias * valorDiaria;
        
        document.getElementById('dias_calculados').value = `${dias} dia(s)`;
        document.getElementById('valor_total_calculado').value = `R$ ${total.toFixed(2)}`;
    } else {
        document.getElementById('dias_calculados').value = 'Calculado automaticamente';
        document.getElementById('valor_total_calculado').value = 'Calculado automaticamente';
    }
}

async function registrarDiaria() {
    const formData = new FormData(elements.forms.diaria);
    const diaria = Object.fromEntries(formData);
    
    // Adiciona o valor total e dias calculados ao objeto
    diaria.dias_uteis = document.getElementById('dias_calculados').value.replace(' dia(s)', '').replace(/\s+/g, '');
    diaria.valor_total = document.getElementById('valor_total_calculado').value.replace('R$ ', '').replace(',', '.');

    try {
        const response = await fetch(`${API_BASE}/diarias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(diaria)
        });
        
        const result = await response.json();
        
        if (result.status === 'sucesso') {
            showAlert('success', result.mensagem);
            elements.forms.diaria.reset();
            document.getElementById('dias_calculados').value = '';
            document.getElementById('valor_total_calculado').value = '';
            carregarDiarias();
            carregarDashboard();
        } else {
            showAlert('error', result.mensagem);
        }
    } catch (error) {
        showAlert('error', `Erro ao registrar diária: ${error.message}`);
    }
}

async function carregarDiarias() {
    try {
        const response = await fetch(`${API_BASE}/diarias`);
        const data = await response.json();
        
        if (data.status === 'sucesso') {
            renderizarDiarias(data.diarias);
        } else {
            elements.diariasLista.innerHTML = `<div class="alert alert-error">${data.mensagem}</div>`;
        }
    } catch (error) {
        elements.diariasLista.innerHTML = `<div class="alert alert-error">Erro ao carregar diárias: ${error.message}</div>`;
    }
}

function renderizarDiarias(diarias) {
    if (!diarias || diarias.length === 0) {
        elements.diariasLista.innerHTML = '<div class="alert alert-info">Nenhuma diária registrada.</div>';
        return;
    }

    let html = `
        <div class="table-container">
            <table id="tabela-diarias">
                <thead>
                    <tr>
                        <th>Motorista</th>
                        <th>Período</th>
                        <th>Dias</th>
                        <th>Valor Diária</th>
                        <th>Valor Total</th>
                        <th>Observações</th>
                    </tr>
                </thead>
                <tbody>`;
    
    diarias.forEach(diaria => {
        html += `
            <tr>
                <td>${diaria.motorista}</td>
                <td>${formatarData(diaria.data_inicio)} a ${formatarData(diaria.data_fim)}</td>
                <td>${diaria.dias_uteis}</td>
                <td>R$ ${parseFloat(diaria.valor_diaria_unitaria).toFixed(2)}</td>
                <td>R$ ${parseFloat(diaria.valor_total).toFixed(2)}</td>
                <td>${diaria.observacoes || '-'}</td>
            </tr>`;
    });

    html += '</tbody></table></div>';
    elements.diariasLista.innerHTML = html;
}

// ===== ANÁLISE E GRÁFICOS (mantido o código original) =====
async function carregarAnalise() {
    // Coleta filtros
    const filtros = {
        veiculo: document.getElementById('filtro-veiculo').value,
        placa: document.getElementById('filtro-placa').value,
        motorista: document.getElementById('filtro-motorista').value,
        ano: document.getElementById('filtro-ano').value,
        mes: document.getElementById('filtro-mes').value
    };

    // Constrói query string (ex: ?veiculo=Carro+A&ano=2024)
    const queryString = new URLSearchParams(filtros).toString();

    try {
        // Envia a URL com os filtros para o backend
        const response = await fetch(`${API_BASE}/analise?${queryString}`);
        
        // ... (resto do tratamento da resposta)
        
        if (!response.ok) {
             throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'sucesso') {
            dadosAnalise = data.analise;
            atualizarGraficos(); // Atualiza os gráficos com os dados FILTRADOS
            // Garante que os filtros sejam carregados se for a primeira vez
            if (document.getElementById('filtro-veiculo').options.length <= 1) {
                 await carregarFiltros();
            }
        } else {
             throw new Error(data.mensagem || 'Erro ao carregar análise');
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar análise:', error);
        showAlert('error', `Erro ao carregar análise: ${error.message}`);
    }
}

function atualizarGraficos() {
    console.log('🎨 Atualizando gráficos...', dadosAnalise);
    
    // Gráfico de Gastos por Tipo
    if (dadosAnalise.gastos.por_tipo && Object.keys(dadosAnalise.gastos.por_tipo).length > 0) {
        atualizarGrafico(
            'graficoPorTipo',
            'pie',
            dadosAnalise.gastos.por_tipo,
            'Gastos por Tipo'
        );
    } else {
        // Destrói se estiver vazio
        if (graficos['graficoPorTipo']) graficos['graficoPorTipo'].destroy();
        document.getElementById('graficoPorTipo').innerHTML = '<div class="alert alert-info">Sem dados para este filtro.</div>';
    }

    // Gráfico de Gastos por Veículo
    if (dadosAnalise.gastos.por_veiculo && Object.keys(dadosAnalise.gastos.por_veiculo).length > 0) {
        atualizarGrafico(
            'graficoPorVeiculo',
            'bar',
            dadosAnalise.gastos.por_veiculo,
            'Gastos por Veículo'
        );
    } else {
        if (graficos['graficoPorVeiculo']) graficos['graficoPorVeiculo'].destroy();
        document.getElementById('graficoPorVeiculo').innerHTML = '<div class="alert alert-info">Sem dados para este filtro.</div>';
    }

    // Gráfico de Gastos por Placa
    if (dadosAnalise.gastos.por_placa && Object.keys(dadosAnalise.gastos.por_placa).length > 0) {
        atualizarGrafico(
            'graficoPorPlaca',
            'bar',
            dadosAnalise.gastos.por_placa,
            'Gastos por Placa',
            true // horizontal
        );
    } else {
        if (graficos['graficoPorPlaca']) graficos['graficoPorPlaca'].destroy();
        document.getElementById('graficoPorPlaca').innerHTML = '<div class="alert alert-info">Sem dados para este filtro.</div>';
    }

    // Gráfico de Diárias por Motorista
    if (dadosAnalise.diarias.por_motorista && Object.keys(dadosAnalise.diarias.por_motorista).length > 0) {
        atualizarGrafico(
            'graficoDiariaMotorista',
            'doughnut',
            dadosAnalise.diarias.por_motorista,
            'Diárias por Motorista'
        );
    } else {
        if (graficos['graficoDiariaMotorista']) graficos['graficoDiariaMotorista'].destroy();
        document.getElementById('graficoDiariaMotorista').innerHTML = '<div class="alert alert-info">Sem dados para este filtro.</div>';
    }

    // Gráfico Mensal
    if ((dadosAnalise.gastos.mensal && Object.keys(dadosAnalise.gastos.mensal).length > 0) || 
        (dadosAnalise.diarias.mensal && Object.keys(dadosAnalise.diarias.mensal).length > 0)) {
        atualizarGraficoMensal();
    } else {
        if (graficos['graficoMensal']) graficos['graficoMensal'].destroy();
        document.getElementById('graficoMensal').innerHTML = '<div class="alert alert-info">Sem dados mensais para este filtro.</div>';
    }
}

function atualizarGrafico(canvasId, tipo, dados, titulo, horizontal = false) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return; // Garante que o canvas existe
    const ctx = canvas.getContext('2d');
    
    // Destroi gráfico existente
    if (graficos[canvasId]) {
        graficos[canvasId].destroy();
    }

    const labels = Object.keys(dados);
    const valores = Object.values(dados);
    const cores = gerarCores(labels.length);

    // Calcula total
    const total = valores.reduce((sum, val) => sum + val, 0);

    graficos[canvasId] = new Chart(ctx, {
        type: tipo,
        data: {
            labels: labels,
            datasets: [{
                label: titulo,
                data: valores,
                backgroundColor: cores,
                borderColor: tipo === 'line' ? cores[0].replace('0.6', '1') : cores.map(c => c.replace('0.6', '1')),
                borderWidth: tipo === 'line' ? 2 : 1 
            }]
        },
        options: {
            indexAxis: horizontal ? 'y' : 'x',
            responsive: true,
            maintainAspectRatio: false, // Permite maior controle de tamanho se necessário
            plugins: {
                title: {
                    display: true,
                    text: `${titulo} - Total: R$ ${total.toFixed(2)}`,
                    font: {
                        size: 16
                    }
                },
                legend: {
                    display: tipo === 'pie' || tipo === 'doughnut',
                    position: 'bottom'
                }
            },
            scales: {
                x: { 
                    beginAtZero: true,
                    display: tipo !== 'pie' && tipo !== 'doughnut',
                    ticks: {
                        callback: function(value) {
                            // Limita rótulo no eixo X para gráficos de barra/coluna
                            return this.getLabelForValue(value).length > 15 
                                ? this.getLabelForValue(value).substring(0, 15) + '...' 
                                : this.getLabelForValue(value);
                        }
                    }
                },
                y: { 
                    beginAtZero: true,
                    display: tipo !== 'pie' && tipo !== 'doughnut'
                }
            }
        }
    });
}

function atualizarGraficoMensal() {
    const ctx = document.getElementById('graficoMensal').getContext('2d');
    
    if (graficos['graficoMensal']) {
        graficos['graficoMensal'].destroy();
    }

    // Combina dados mensais de gastos e diárias
    const meses = [...new Set([
        ...Object.keys(dadosAnalise.gastos.mensal || {}),
        ...Object.keys(dadosAnalise.diarias.mensal || {})
    ])].sort();

    const gastosMensais = meses.map(mes => dadosAnalise.gastos.mensal[mes] || 0);
    const diariasMensais = meses.map(mes => dadosAnalise.diarias.mensal[mes] || 0);

    graficos['graficoMensal'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: meses.map(mes => formatarMesAno(mes)),
            datasets: [
                {
                    label: 'Gastos',
                    data: gastosMensais,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0,123,255,0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                },
                {
                    label: 'Diárias',
                    data: diariasMensais,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40,167,69,0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Evolução Mensal - Gastos vs Diárias'
                },
                legend: {
                    display: true
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Valor (R$)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Mês'
                    }
                }
            }
        }
    });
}

function formatarMesAno(mesAno) {
    try {
        const [ano, mes] = mesAno.split('-');
        const data = new Date(ano, mes - 1);
        return data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    } catch (e) {
        return mesAno;
    }
}

async function carregarFiltros() {
    try {
        console.log('🔍 Carregando filtros...');
        const response = await fetch(`${API_BASE}/filtros`);
        const data = await response.json();
        
        if (data.status === 'sucesso') {
            preencherSelect('filtro-veiculo', data.filtros.veiculos);
            preencherSelect('filtro-placa', data.filtros.placas);
            preencherSelect('filtro-motorista', data.filtros.motoristas_gastos);
            preencherSelect('filtro-ano', data.filtros.anos);
            
            console.log('✅ Filtros carregados:', data.filtros);
        } else {
            console.warn('⚠️ Filtros não disponíveis:', data.mensagem);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar filtros:', error);
    }
}

function preencherSelect(selectId, opcoes) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // Mantém a primeira opção
    const primeiraOpcao = select.options[0] ? select.options[0].textContent : 'Todos';
    select.innerHTML = `<option value="">${primeiraOpcao}</option>`;
    
    if (opcoes && opcoes.length > 0) {
        opcoes.forEach(opcao => {
            if (opcao) {
                const option = document.createElement('option');
                option.value = opcao;
                option.textContent = opcao;
                select.appendChild(option);
            }
        });
    }
}

document.getElementById('aplicar-filtro').addEventListener('click', carregarAnalise);
document.getElementById('limpar-filtros').addEventListener('click', () => {
    document.querySelectorAll('#painel-filtros select').forEach(select => {
        select.value = '';
    });
    carregarAnalise();
});


// ===== UTILITÁRIOS =====
function formatarData(data) {
    if (!data) return '-';
    // Adiciona T00:00:00 para garantir que a data seja interpretada corretamente como UTC
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
}

function gerarCores(quantidade) {
    const cores = [
        'rgba(255,99,132,0.6)',
        'rgba(54,162,235,0.6)',
        'rgba(255,206,86,0.6)',
        'rgba(75,192,192,0.6)',
        'rgba(153,102,255,0.6)',
        'rgba(255,159,64,0.6)',
        'rgba(199,199,199,0.6)',
        'rgba(83,102,255,0.6)',
        'rgba(40,159,64,0.6)',
        'rgba(210,105,30,0.6)'
    ];
    // Repete as cores se a quantidade for maior que o array
    return Array.from({ length: quantidade }, (_, i) => cores[i % cores.length]);
}

function showAlert(type, message) {
    const alertClass = type === 'success' ? 'alert-success' : type === 'error' ? 'alert-error' : 'alert-info';
    const alert = document.createElement('div');
    alert.className = `alert ${alertClass}`;
    alert.innerHTML = `<strong>${type === 'success' ? '✅ Sucesso!' : type === 'error' ? '❌ Erro!' : 'ℹ️ Info'}</strong> ${message}`;
    
    // Insere após o título H1, antes do dashboard
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(alert, document.getElementById('dashboard'));
    }
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Sistema iniciando...');
    
    // Define data atual como padrão
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('data').value = hoje;
    document.getElementById('data_inicio').value = hoje;
    document.getElementById('data_fim').value = hoje;
    
    // Carrega dados iniciais
    carregarDashboard();
    
    console.log('✅ Sistema inicializado!');
});

// Torna funções globais para os botões chamados no HTML
window.editarGasto = editarGasto;
window.excluirGasto = excluirGasto;
// Ajuste para a função openTab, que agora precisa ser chamada com o evento
window.openTab = function(event, tabName) {
    // A função openTab original foi renomeada no escopo global para evitar conflitos
    // e o event agora é passado do HTML como "openTab(event, 'tab-...')".
    // Aqui fazemos uma chamada interna mais segura.
    // É mais limpo ajustar o HTML de volta para `onclick="openTab('tab-...')"` e remover o `event`
    // ou manter a chamada com `event` e usar a função ajustada `openTab(event, tabName)`.
    // Vou reajustar a chamada do HTML para usar o novo padrão com 'event'.

    // O código aqui reflete a mudança feita na seção 1 (HTML) para aceitar o evento.
    
    // Esconde todas as tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostra a tab selecionada
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
    
    // Carrega dados específicos da tab
    if (tabName === 'tab-analise') {
        console.log('📊 Abrindo aba análise...');
        setTimeout(() => {
            carregarAnalise();
        }, 100);
    } else if (tabName === 'tab-diarias') {
        carregarDiarias();
    } else if (tabName === 'tab-servicos') {
        carregarServicos();
    }
};

window.limparFormGasto = limparFormGasto;