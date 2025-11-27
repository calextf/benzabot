// --- VARIÁVEIS GLOBAIS ---
let currentPage = 1;
const totalPages = 3;

// Endpoints Institucionais
const PROCESS_FORM_URL = "https://prod-31.brazilsouth.logic.azure.com:443/workflows/79da5a022fcb4e8e8efa6290c281e7ed/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=RxJ8ZHPYBBYa_WWUSLf5ElZ0JvVZuRwrX1GBFURXubc";
const FEEDBACK_URL = "https://prod-28.brazilsouth.logic.azure.com:443/workflows/0e4e389740564bf7b79d8fc2aff99581/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=QzjFYLPs_bb7WUpez6Rg9ZWFcfjn335sld8MI9khq8g";
const CHATBOT_API_URL = 'https://prod-229.westeurope.logic.azure.com/workflows/b92fa789262b4a9897e8a8d4f6417509/triggers/manual/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pjZP0IN4KT9NRgFe3PlA6v_cVfeGMOXkGxV2jKTe8Ds';

// URL DO LOGIC APP "BenzaBot-Tags" (Conexão Real)
const GET_TAGS_URL = "https://prod-14.brazilsouth.logic.azure.com:443/workflows/8efac3c4b6d0407db787e2b38ff8bf40/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=dw0drvguzjpc88wVSJPggZS03x-F7kkseK0Cb0v-m-4"; 

const BENZABOT_AVATAR_URL = "https://drive.google.com/thumbnail?id=1F-gb-vUWTzlVIQyfqNOiIFsGPxc_j2d6&sz=w1000";

// Variáveis de Estado
let currentResponseData = { hash: null, equipe: null };
let ratingValue = 0;
let hoverValue = 0;
let isRatingLocked = false;
let cachedTags = null; // Cache para as tags do glossário

let copyMessageTimeout; 
let flashTimeout;
let isProcessing = false;

// --- FUNÇÕES DE UTILIDADE ---

function showFlashMessage(message) {
    const flash = document.getElementById('flashMessage');
    flash.textContent = message;
    flash.classList.add('active');
    clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => { flash.classList.remove('active'); }, 3000);
}

function filterProtocol(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

// --- LÓGICA DO GLOSSÁRIO DE TAGS (CONECTADA AO AZURE) ---

// 1. Abrir Modal
function openGlossary() {
    const overlay = document.getElementById('glossaryOverlay');
    const container = document.getElementById('glossaryContainer');
    const sidebar = document.getElementById('sidebar');

    // Fecha o menu lateral se estiver aberto
    if(sidebar) sidebar.classList.remove('open');

    // Mostra o overlay
    overlay.style.display = 'flex';
    
    // Animação de entrada
    setTimeout(() => {
        overlay.classList.remove('pointer-events-none', 'opacity-0');
        container.classList.remove('scale-95');
        container.classList.add('scale-100');
    }, 10);

    // Carrega os dados reais
    loadGlossaryData(); 
}

// 2. Fechar Modal
function closeGlossary() {
    const overlay = document.getElementById('glossaryOverlay');
    const container = document.getElementById('glossaryContainer');

    // Animação de saída
    overlay.classList.add('opacity-0', 'pointer-events-none');
    container.classList.remove('scale-100');
    container.classList.add('scale-95');

    // Espera a animação terminar para esconder o elemento
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 300);
}

// 3. Carregar Dados (REAL - Azure Logic App)
async function loadGlossaryData() {
    // Se já temos cache, usa ele para evitar recarregamento e custo de API
    if (cachedTags) {
        renderTags(cachedTags);
        return;
    }

    const content = document.getElementById('glossaryContent');
    
    // Mostra Spinner de Carregamento
    content.innerHTML = `
        <div class="text-center text-gray-500 mt-10">
            <div class="spinner border-4 border-gray-200 border-t-cyan-600 rounded-full w-8 h-8 animate-spin mx-auto mb-2"></div>
            <p class="text-sm">Buscando tags atualizadas...</p>
        </div>`;

    try {
        const response = await fetch(GET_TAGS_URL);
        
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        
        const data = await response.json();
        
        // Normalização: O Logic App pode retornar { tags: [...] } ou direto [...]
        // Ajuste conforme a estrutura final do seu JSON
        let tagsDoAzure = [];
        if (data.tags && Array.isArray(data.tags)) {
            tagsDoAzure = data.tags;
        } else if (Array.isArray(data)) {
            tagsDoAzure = data;
        } else if (data.value && Array.isArray(data.value)) {
            tagsDoAzure = data.value;
        }

        if (tagsDoAzure.length === 0) {
            content.innerHTML = '<p class="text-center text-gray-500 text-sm mt-4">Nenhuma tag encontrada na base.</p>';
            return;
        }

        // Salva no cache e renderiza
        cachedTags = tagsDoAzure;
        renderTags(tagsDoAzure);

    } catch (error) {
        console.error("Erro ao carregar glossário:", error);
        content.innerHTML = `
            <div class="text-center text-red-500 mt-10 px-4">
                <p class="font-bold">Falha ao carregar.</p>
                <p class="text-xs mt-1">Verifique sua conexão.</p>
                <button onclick="loadGlossaryData()" class="mt-3 text-cyan-600 underline text-sm hover:text-cyan-800">Tentar novamente</button>
            </div>`;
    }
}

// 4. Renderizar Lista na Tela
function renderTags(tags) {
    const content = document.getElementById('glossaryContent');
    content.innerHTML = '';

    if (!tags || tags.length === 0) {
        content.innerHTML = '<p class="text-center text-gray-500 text-sm mt-4">Nenhuma tag correspondente.</p>';
        return;
    }

    tags.forEach(tag => {
        // Proteção contra campos vazios
        const rawTag = tag.Tags || tag.TAG || "Sem Nome"; // Tenta 'Tags' (do seu Excel) ou 'TAG'
        const rawDesc = tag.Respostas || tag.RespostaBase || ""; // Tenta 'Respostas' ou 'RespostaBase'
        const rawEquipe = tag.Equipe || tag.EQUIPE || "GERAL";

        // Remove o # apenas visualmente se ele existir
        const displayTag = rawTag.startsWith('#') ? rawTag.substring(1) : rawTag;
        // Valor para cópia
        const copyValue = displayTag; 

        const item = document.createElement('div');
        item.className = 'p-3 border border-gray-200 rounded-lg hover:border-cyan-500 hover:shadow-sm transition bg-white group cursor-pointer relative';
        
        item.onclick = () => copyTagToClipboard(copyValue);
        
        item.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="pr-6">
                    <span class="font-mono text-sm font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded">${displayTag}</span>
                    <p class="text-xs text-gray-500 mt-2 line-clamp-2">${rawDesc || 'Sem descrição disponível.'}</p>
                    <span class="text-[10px] text-gray-400 uppercase font-bold mt-2 block tracking-wider">${rawEquipe}</span>
                </div>
                <div class="absolute top-3 right-3 text-gray-300 group-hover:text-cyan-600 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </div>
            </div>
        `;
        content.appendChild(item);
    });
}

// 5. Filtro de Busca
function filterTags(query) {
    if (!cachedTags) return;
    const lowerQuery = query.toLowerCase();
    
    const filtered = cachedTags.filter(t => {
        const tTag = (t.Tags || t.TAG || "").toLowerCase();
        const tDesc = (t.Respostas || t.RespostaBase || "").toLowerCase();
        const tEquipe = (t.Equipe || t.EQUIPE || "").toLowerCase();
        
        return tTag.includes(lowerQuery) || tDesc.includes(lowerQuery) || tEquipe.includes(lowerQuery);
    });
    
    renderTags(filtered);
}

// 6. Copiar Tag
function copyTagToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showFlashMessage(`Tag copiada: ${text}`);
        }).catch(err => {
            console.error("Erro Clipboard API", err);
            fallbackCopyText(text);
        });
    } else {
        fallbackCopyText(text);
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand("copy");
        showFlashMessage(`Tag copiada: ${text}`);
    } catch (err) {
        showFlashMessage("Erro ao copiar tag.");
    }
    document.body.removeChild(textArea);
}

// --- FUNÇÕES DO CHAT (MANTIDAS) ---
function addMessageToChat(sender, message) { /* ... mantido ... */ }
async function simulateUserMessage() { /* ... mantido ... */ }

// --- EXPORTAÇÕES GLOBAIS ---
window.openGlossary = openGlossary;
window.closeGlossary = closeGlossary;
window.openChatBot = function() {
    const overlay = document.getElementById('chatBotOverlay');
    overlay.style.display = 'flex';
    setTimeout(() => {
        overlay.classList.remove('pointer-events-none', 'opacity-0');
    }, 10);
};
window.closeChatBotAndGoHome = function() {
    const overlay = document.getElementById('chatBotOverlay');
    overlay.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
};
window.handleStarMouseOut = handleStarMouseOut; 
window.copyResponse = copyResponse;
window.loadAndChangePage = loadAndChangePage;
window.toggleSidebar = toggleSidebar;
window.simulateUserMessage = simulateUserMessage;
window.initializeTypewriter = initializeTypewriter;
window.filterProtocol = filterProtocol; 

// --- RESET E NAVEGAÇÃO ---
function resetFormFields() {
    document.getElementById('protocolo').value = '';
    document.getElementById('perguntaAluno').value = '';
    document.getElementById('tags').value = '';
    document.getElementById('sazonalidade').value = '';
    document.getElementById('tom').value = '';
    document.getElementById('equipe').value = '';
    resetRating();
}

async function loadAndChangePage(nextPage) {
    // (Mesma lógica original de envio para o Azure)
    if (nextPage !== 3) return changePage(nextPage);
    if (isProcessing) return;
    
    const protocolo = document.getElementById('protocolo').value.trim();
    const pergunta = document.getElementById('perguntaAluno').value.trim();
    const equipe = document.getElementById('equipe').value; 
    const tags = document.getElementById('tags').value.trim(); 
    const sazonalidade = document.getElementById('sazonalidade').value.trim();
    const tom = document.getElementById('tom').value.trim();

    if (protocolo === "") { showFlashMessage("O campo 'Protocolo' é obrigatório."); return; }
    if (pergunta === "") { showFlashMessage("O campo 'Pergunta' é obrigatório."); return; }
    if (equipe === "") { showFlashMessage("Selecione uma Equipe."); return; }
    if (tags === "") { showFlashMessage("Tags são obrigatórias."); return; }

    isProcessing = true;
    const overlay = document.getElementById('loadingOverlay');
    const responseBox = document.getElementById('responseBox');
    overlay.style.display = 'flex';
    responseBox.textContent = "Processando no Azure... aguarde.";

    const data = { protocolo, pergunta, tags, sazonalidade, tom, equipe, feedback: 0 };

    try {
        changePage(nextPage); 
        const response = await fetch(PROCESS_FORM_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json(); 
        if (!response.ok) {
            if (result && result.status === "rejeitado_cache_vazio") {
                 responseBox.innerText = "Nenhum conteúdo institucional encontrado para as tags fornecidas.";
                 return;
            }
            throw new Error(result.erro || "Erro desconhecido no Azure.");
        }
        if (result && result.respostaEstilizada) {
            currentResponseData.equipe = equipe;
            currentResponseData.hash = result.hash;
            responseBox.innerText = result.respostaEstilizada;
        } else {
            throw new Error("Resposta inválida do Azure.");
        }
    } catch (error) {
        console.error("Erro Azure:", error);
        responseBox.innerText = `Erro: ${error.message}`;
    } finally {
        overlay.style.display = 'none';
        isProcessing = false;
    }
}

// --- FEEDBACK (CONECTADO AO AZURE) ---

async function sendFeedbackToAzure(nota) {
    if (!currentResponseData.equipe || !currentResponseData.hash) {
        console.warn("Dados de hash/equipe ausentes para feedback.");
        return;
    }
    const payload = { hash: currentResponseData.hash, equipe: currentResponseData.equipe, feedback: nota };
    try {
        await fetch(FEEDBACK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log("Feedback enviado.");
    } catch (e) { console.error("Erro ao enviar feedback:", e); }
}

function resetRating() {
    ratingValue = 0;
    hoverValue = 0;
    isRatingLocked = false;
    // Limpa o container para forçar recriação limpa ao entrar na página 3 novamente
    const starContainer = document.getElementById('starContainer');
    if (starContainer) starContainer.innerHTML = '';
    updateStarDisplay(); 
}

// --- FUNÇÃO DE AVALIAÇÃO COM MENSAGENS ALEATÓRIAS (PERSONALIZADA) ---
function lockRating(value) {
    if (isRatingLocked) return;
    ratingValue = value;
    isRatingLocked = true;
    updateStarDisplay();

    const mensagens = {
        1: [ "Obrigada pelo retorno, prometo melhorar!", "Sua opinião me ajuda a evoluir." ],
        2: [ "Valeu pelo feedback, sigo em ajuste.", "Agradeço, bora buscar melhorias." ],
        3: [ "Obrigada! Continuarei em aprimoramento.", "Seu retorno me guia para evoluir." ],
        4: [ "Que bom poder ajudar!", "Fico felizes com sua experiência." ],
        5: [ "Excelente! Ótimo saber disso.", "Estou feliz em atender você!" ]
    };

    // Escolhe uma das alternativas de forma aleatória, com fallback
    let opcoes = mensagens[value] || [`Obrigada! Feedback de ${value} estrelas enviado.`];
    let mensagem = opcoes[Math.floor(Math.random() * opcoes.length)];

    showFlashMessage(mensagem);
    sendFeedbackToAzure(value);
}

function handleStarHover(value) {
    if (isRatingLocked) return;
    hoverValue = value;
    updateStarDisplay();
}

function handleStarMouseOut() {
    if (isRatingLocked) return;
    hoverValue = 0;
    updateStarDisplay(); 
}

function updateStarDisplay() {
    const starContainer = document.getElementById('starContainer');
    if (!starContainer) return;

    const displayValue = isRatingLocked ? ratingValue : (hoverValue || ratingValue);

    // 1. CRIAÇÃO ÚNICA (Se estiver vazio, cria as estrelas)
    // Isso resolve o problema do clique falhando
    if (starContainer.children.length === 0) {
        for (let i = 1; i <= 5; i++) {
            const starDiv = document.createElement('div');
            // Classes Tailwind para tamanho, cursor e transição suave
            starDiv.className = 'w-10 h-10 cursor-pointer transition-colors duration-200 text-gray-300'; 
            
            // SVG com 'pointer-events-none' para garantir que o clique acerte a DIV, não o desenho
            starDiv.innerHTML = `<svg class="pointer-events-none w-full h-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
            
            // Adiciona os eventos apenas uma vez na criação
            starDiv.onclick = () => lockRating(i);
            starDiv.onmouseenter = () => handleStarHover(i); // Usar mouseenter é mais estável que mouseover
            starDiv.onmouseleave = () => handleStarMouseOut();

            starContainer.appendChild(starDiv);
        }
    }

    // 2. ATUALIZAÇÃO DE ESTADO (Apenas troca as cores)
    const stars = starContainer.children;
    for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const value = i + 1;

        // Remove as cores antigas
        star.classList.remove('text-cyan-400', 'text-gray-300');

        if (value <= displayValue) {
            // Estrela preenchida (Ciano)
            star.classList.add('text-cyan-400');
        } else {
            // Estrela vazia (Cinza)
            star.classList.add('text-gray-300');
        }

        // Se travado, muda o cursor para indicar que não é mais clicável
        star.style.cursor = isRatingLocked ? 'default' : 'pointer';
    }
}

function copyResponse() { /* ...Mantido... */
    const responseBox = document.getElementById('responseBox');
    const copyMessage = document.getElementById('copyMessage');
    try {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(responseBox.innerText).then(() => showCopySuccess()).catch(() => fallbackCopyText(responseBox.innerText));
        } else { fallbackCopyText(responseBox.innerText); }
    } catch (err) { showFlashMessage("Erro ao copiar."); }
    function showCopySuccess() {
        copyMessage.style.opacity = '1';
        clearTimeout(copyMessageTimeout); 
        copyMessageTimeout = setTimeout(() => { copyMessage.style.opacity = '0'; }, 2000); 
    }
    function fallbackCopyText(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showCopySuccess();
    }
}

function initializeTypewriter() { const f = document.getElementById('typewriter-text'); if(f) f.style.width = 'auto'; }

function changePage(nextPage) {
    if (nextPage < 1 || nextPage > totalPages || currentPage === nextPage) {
        document.getElementById('sidebar').classList.remove('open');
        return; 
    }
    const currentContainer = document.getElementById(`page${currentPage}`);
    const nextContainer = document.getElementById(`page${nextPage}`);
    if (nextPage === 2) { resetFormFields(); resetRating(); }

    document.getElementById('chatBotOverlay').style.display = 'none';
    document.getElementById('glossaryOverlay').style.display = 'none'; 
    document.getElementById('glossaryContainer').classList.remove('active'); 

    currentContainer.classList.remove('active');
    if (currentPage === 2) {
        document.querySelectorAll('#page2 .form-field').forEach(el => { el.style.opacity = 0; el.style.transform = 'translateY(20px)'; });
    }
    
    setTimeout(() => {
        currentContainer.style.display = 'none';
        if (nextPage === 3) updateStarDisplay(); 
        currentPage = nextPage;
        if (nextPage === 1 || nextPage === 2 || nextPage === 3) nextContainer.style.display = 'flex';
        else nextContainer.style.display = 'block';
        void nextContainer.offsetWidth; 
        nextContainer.classList.add('active');
        if (currentPage === 2) {
            const fields = document.querySelectorAll('#page2 .form-field');
            fields.forEach((el, index) => {
                el.style.transitionDelay = `${index * 0.1}s`;
                el.style.opacity = '0'; el.style.transform = 'translateY(20px)';
                void el.offsetWidth;
                setTimeout(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; }, 50); 
            });
        }
        document.getElementById('sidebar').classList.remove('open');
    }, 500); 
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.page-container').forEach(el => el.style.display = 'none');
    const initialPage = document.getElementById('page1');
    initialPage.style.display = 'flex'; 
    void initialPage.offsetWidth; 
    initialPage.classList.add('active');
    currentPage = 1; 
    initializeTypewriter(); 
});