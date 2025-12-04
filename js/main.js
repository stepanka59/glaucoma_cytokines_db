class CytokinesDatabase {
    constructor() {
        this.data = null;
        this.filteredData = [];
        this.currentSort = 'name';
        this.currentFilters = {
            search: '',
            minSamples: 0
        };
        this.init();
    }

    async init() {
        try {
            console.log('Загрузка данных...');
            const response = await fetch('./data/cytokines_final.json');
            
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            
            this.data = await response.json();
            console.log(`Загружено цитокинов: ${this.data.цитокины.length}`);
            
            this.filteredData = [...this.data.цитокины];
            this.updateGeneralStats();
            this.renderTable();
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.showError('Не удалось загрузить данные.');
        }
    }

    updateGeneralStats() {
        const totalCytokines = this.data.цитокины.length;
        const totalMeasurements = this.data.метаданные.всего_измерений;
        
        const cytokinesWithData = this.data.цитокины.filter(cytokine => {
            return Object.values(cytokine.стадии).some(stage => stage.n > 0);
        }).length;
        
        document.getElementById('totalCytokines').textContent = totalCytokines;
        document.getElementById('totalMeasurements').textContent = totalMeasurements;
        document.getElementById('cytokinesWithData').textContent = cytokinesWithData;
    }

    applyFilters() {
        const searchTerm = document.getElementById('searchCytokine').value.toLowerCase();
        const minSamples = parseInt(document.getElementById('minSamples').value) || 0;
        const sortBy = document.getElementById('sortBy').value;
        
        this.currentFilters.search = searchTerm;
        this.currentFilters.minSamples = minSamples;
        this.currentSort = sortBy;
        
        this.filteredData = this.data.цитокины.filter(cytokine => {
            if (searchTerm && !cytokine.название.toLowerCase().includes(searchTerm)) {
                return false;
            }
            
            if (minSamples > 0) {
                const hasEnoughSamples = Object.values(cytokine.стадии).some(stage => stage.n >= minSamples);
                if (!hasEnoughSamples) {
                    return false;
                }
            }
            
            return true;
        });
        
        this.sortData();
        this.renderTable();
    }

    sortData() {
        this.filteredData.sort((a, b) => {
            switch (this.currentSort) {
                case 'name':
                    return a.название.localeCompare(b.название);
                case 'control':
                    return (b.стадии.control?.среднее || 0) - (a.стадии.control?.среднее || 0);
                case 'stage1':
                    return (b.стадии['1']?.среднее || 0) - (a.стадии['1']?.среднее || 0);
                case 'stage2':
                    return (b.стадии['2']?.среднее || 0) - (a.стадии['2']?.среднее || 0);
                case 'stage3':
                    return (b.стадии['3']?.среднее || 0) - (a.стадии['3']?.среднее || 0);
                case 'stage4':
                    return (b.стадии['4']?.среднее || 0) - (a.стадии['4']?.среднее || 0);
                default:
                    return a.название.localeCompare(b.название);
            }
        });
    }

    renderTable() {
        const tbody = document.getElementById('cytokinesTableBody');
        
        if (this.filteredData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 50px; color: #7f8c8d;">
                        Нет цитокинов, соответствующих фильтрам
                    </td>
                </tr>
            `;
            
            document.getElementById('tableInfo').textContent = `Найдено цитокинов: 0`;
            return;
        }
        
        let html = '';
        
        this.filteredData.forEach(cytokine => {
            const stages = ['control', '1', '2', '3', '4'];
            let stagesHtml = '';
            
            stages.forEach(stage => {
                const stageData = cytokine.стадии[stage];
                
                if (stageData && stageData.n > 0) {
                    stagesHtml += `
                        <td class="stage-cell">
                            <div class="stat-value">n = ${stageData.n}</div>
                            <div class="stat-value">${stageData.среднее.toFixed(2)}</div>
                            <div class="stat-std">± ${stageData.стд_отклонение.toFixed(2)}</div>
                        </td>
                    `;
                } else {
                    stagesHtml += `
                        <td class="stage-cell no-data">
                            —
                        </td>
                    `;
                }
            });
            
            html += `
                <tr>
                    <td>
                        <div class="cytokine-name" onclick="window.open('cytokine_detail.html?cytokine=${encodeURIComponent(cytokine.название)}', '_blank')">
                            ${this.escapeHtml(cytokine.название)}
                        </div>
                    </td>
                    ${stagesHtml}
                    <td>
                        <button onclick="window.open('cytokine_detail.html?cytokine=${encodeURIComponent(cytokine.название)}', '_blank')" 
                                class="cytokine-link">
                            📊 Подробнее
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        document.getElementById('tableInfo').textContent = 
            `Показано цитокинов: ${this.filteredData.length} из ${this.data.цитокины.length}`;
    }

    setupEventListeners() {
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.applyFilters();
        });
        
        document.getElementById('searchCytokine').addEventListener('input', () => {
            this.applyFilters();
        });
        
        document.getElementById('minSamples').addEventListener('change', () => {
            this.applyFilters();
        });
        
        document.getElementById('sortBy').addEventListener('change', () => {
            this.applyFilters();
        });
        
        document.getElementById('resetFilters').addEventListener('click', () => {
            document.getElementById('searchCytokine').value = '';
            document.getElementById('minSamples').value = 0;
            document.getElementById('sortBy').value = 'name';
            this.applyFilters();
        });
        
        document.getElementById('exportTable').addEventListener('click', () => {
            this.exportToCSV();
        });
    }

    exportToCSV() {
        const headers = ['Цитокин', 'Контроль (n)', 'Контроль (среднее)', 'Контроль (±)',
                        'Стадия 1 (n)', 'Стадия 1 (среднее)', 'Стадия 1 (±)',
                        'Стадия 2 (n)', 'Стадия 2 (среднее)', 'Стадия 2 (±)',
                        'Стадия 3 (n)', 'Стадия 3 (среднее)', 'Стадия 3 (±)',
                        'Стадия 4 (n)', 'Стадия 4 (среднее)', 'Стадия 4 (±)'];
        
        const csvRows = [headers.join(',')];
        
        this.filteredData.forEach(cytokine => {
            const row = [cytokine.название];
            const stages = ['control', '1', '2', '3', '4'];
            
            stages.forEach(stage => {
                const data = cytokine.стадии[stage];
                if (data && data.n > 0) {
                    row.push(data.n, data.среднее.toFixed(4), data.стд_отклонение.toFixed(4));
                } else {
                    row.push('', '', '');
                }
            });
            
            csvRows.push(row.join(','));
        });
        
        const csvString = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `cytokines_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    showError(message) {
        const tbody = document.getElementById('cytokinesTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 50px; color: #e74c3c;">
                    <div style="font-size: 1.2rem; margin-bottom: 10px;">⚠️ Ошибка</div>
                    <div>${message}</div>
                </td>
            </tr>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.database = new CytokinesDatabase();
});
