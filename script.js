// --- VARIÁVEIS DE CONFIGURAÇÃO ---

let currentPage = 1;
const totalPages = 3;
const BENZABOT_AVATAR_URL = "https://drive.google.com/thumbnail?id=1F-gb-vUWTzlVIQyfqNOiIFsGPxc_j2d6&sz=w1000";

// Endpoints Institucionais (CORRIGIDOS)
const PROCESS_FORM_URL = "https://prod-31.brazilsouth.logic.azure.com:443/workflows/79da5a022fcb4e8e8efa6290c281e7ed/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=RxJ8ZHPYBBYa_WWUSLf5ElZ0JvVZuRwrX1GBFURXubc";
const FEEDBACK_URL = "https://prod-28.brazilsouth.logic.azure.com:443/workflows/0e4e389740564bf7b79d8fc2aff99581/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=QzjFYLPs_bb7WUpez6Rg9ZWFcfjn335sld8MI9khq8g";
const CHATBOT_API_URL = 'https://prod-229.westeurope.logic.azure.com/workflows/b92fa789262b4a9897e8a8d4f6417509/triggers/manual/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pjZP0IN4KT9NRgFe3PlA6v_cVfeGMOXkGxV2jKTe8Ds';

// --- ESTADOS ---

let currentResponseData = { hash: null, equipe: null };
let ratingValue = 0;
let hoverValue = 0;
let isRatingLocked = false;
let copyMessageTimeout;
let isProcessing = false;

// --- FUNÇÕES DE UTILIDADE ---

function filterProtocol(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

function resetFormFields() {
    document.getElementById('protocolo').value = '';
    document.getElementById('perguntaAluno').value = '';
    document.getElementById('tags').value = '';
    document.getElementById('sazonalidade').value = '';
    document.getElementById('tom').value = '';
    document.getElementById('equipe').value = '';
    resetRating(); // <-- Garante que as estrelas sejam resetadas
    console.log("Formulário resetado automaticamente.");
}

function displayResponse(resposta) {
    document.getElementById('responseBox').innerText = resposta;
}

// --- LÓGICA DE COPIAR RESPOSTA ---

function copyResponse() {
    const responseBox = document.getElementById('responseBox');
    const copyMessage = document.getElementById('copyMessage');

    try {
        const textarea = document.createElement('textarea');
        textarea.value = responseBox.innerText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        copyMessage.style.opacity = '1';
        clearTimeout(copyMessageTimeout);
        copyMessageTimeout = setTimeout(() => {
            copyMessage.style.opacity = '0';
        }, 2000);
    } catch (err) {
        console.error('Erro ao copiar a resposta:', err);
    }
}

// --- FUNÇÃO DE FEEDBACK DE AVALIAÇÃO ---

async function sendFeedback(nota) {
    if (!currentResponseData.equipe) {
        console.warn('Equipe ausente. Feedback não enviado.');
        return;
    }
    
    console.log(`[FEEDBACK] Enviando nota ${nota} para o protocolo: ${currentResponseData.hash} (Equipe: ${currentResponseData.equipe})`);
    
    try {
        await fetch(FEEDBACK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hash: currentResponseData.hash,
                equipe: currentResponseData.equipe,
                feedback: nota
            })
        });
    } catch (error) {
        console.error("Falha ao enviar feedback:", error);
    }
}

// --- FUNÇÕES DE ESTRELA (LÓGICA DE "TRAVA" CORRIGIDA) ---

function handleStarClick(value) {
    // Se já clicou, não faz nada (impede duplo clique)
    if (isRatingLocked) return; 
    
    ratingValue = value;
    isRatingLocked = true; // <-- A "TRAVA"
    updateStarDisplay();
    sendFeedback(value); // Envia o feedback para o Logic App
}

function handleStarMouseOver(value) {
    // Se a seleção já foi travada (clicada), ignora o mouse over
    if (isRatingLocked) return; 
    
    hoverValue = value;
    updateStarDisplay();
}

function handleStarMouseOut() {
    // Se a seleção já foi travada, ignora o mouse out
    if (isRatingLocked) return; 
    
    hoverValue = 0;
    updateStarDisplay();
}

function updateStarDisplay() {
    const stars = document.getElementById('starContainer');
    if (!stars) return;
    stars.innerHTML = '';
    
    // Prioriza o valor clicado (ratingValue) sobre o valor do mouse (hoverValue)
    const rating = isRatingLocked ? ratingValue : hoverValue; 
    
    for (let i = 1; i <= 5; i++) {
        const star = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        star.setAttribute("class", `star-icon ${i <= rating ? 'star-filled' : ''}`);
        star.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        star.setAttribute("viewBox", "0 0 576 512");
        star.innerHTML = '<path fill="currentColor" d="M259.3 17.8L194 150.2 47.9 171.5c-26.2 3.8-36.7 36.1-17.7 54.6l105.7 103-25 146.4c-4.5 26.3 23.2 46 46.4 33.7L288 439.6l130.7 68.7c23.2 12.2 50.9-7.4 46.4-33.7l-25-146.4 105.7-103c19-18.5 8.5-50.8-17.7-54.6L382 150.2 316.7 17.8c-11.7-23.4-45.7-23.4-57.4 0z"/>';
        star.addEventListener('click', () => handleStarClick(i));
        star.addEventListener('mouseover', () => handleStarMouseOver(i));
        star.addEventListener('mouseout', handleStarMouseOut);
        stars.appendChild(star);
    }
    if (isRatingLocked) {
        let msg = document.getElementById('feedbackMessage');
        if (!msg) {
            msg = document.createElement('p');
            msg.id = 'feedbackMessage';
            msg.style.marginTop = '10px';
            msg.style.fontSize = '14px';
            stars.parentNode.insertBefore(msg, stars.nextSibling);
        }
        msg.textContent = '✅ Obrigado pelo feedback!';
    }
}

// Reseta a trava e o valor quando volta para a Page 2
function resetRating() {
    ratingValue = 0;
    hoverValue = 0;
    isRatingLocked = false; 
    updateStarDisplay();
    const msg = document.getElementById('feedbackMessage');
    if (msg) msg.remove();
}


// --- FUNÇÕES DO CHATBOT (Simulação) ---

function addMessageToChat(sender, message, type = 'message') {
    const chatContent = document.getElementById('chatContent');
    const isBot = sender === 'bot';
    
    if (isBot) {
        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = `bot-message-wrapper ${type}`;
        
        const avatarImg = document.createElement('img');
        avatarImg.src = BENZABOT_AVATAR_URL;
        avatarImg.alt = "Avatar do BenzaBot";
        avatarImg.className = 'bot-avatar';
        
        const messageDiv = document.createElement('div');
        messageDiv.innerHTML = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); 
        messageDiv.className = 'bot-message';
        
        wrapperDiv.appendChild(avatarImg);
        wrapperDiv.appendChild(messageDiv);
        chatContent.appendChild(wrapperDiv);
    } else { // 'user'
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.className = 'user-message';
        chatContent.appendChild(messageDiv);
    }
    chatContent.scrollTop = chatContent.scrollHeight;
}

async function simulateUserMessage() {
    const input = document.getElementById('chatInput');
    const userText = input.value.trim();
    if (userText === "") return;
    
    addMessageToChat('user', userText);
    input.value = '';
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'bot-message-wrapper typing';
    typingIndicator.innerHTML = '<img src="' + BENZABOT_AVATAR_URL + '" alt="Avatar do BenzaBot" class="bot-avatar"><div class="bot-message message-balloon">Digitando</div>';
    document.getElementById('chatContent').appendChild(typingIndicator);
    document.getElementById('chatContent').scrollTop = document.getElementById('chatContent').scrollHeight;

    try {
        const response = await fetch(CHATBOT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userText })
        });

        if (!response.ok) throw new Error(`Erro na requisição: ${response.status}`);
        const data = await response.json();
        
        if (typingIndicator) typingIndicator.remove(); 
        
        if (data && data.message) {
            addMessageToChat('bot', data.message);
        } else {
            throw new Error('Resposta inválida da API');
        }
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
        if (typingIndicator) typingIndicator.remove();
        addMessageToChat('bot', 'Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente mais tarde.');
    }
}

function openChatBot() {
    const overlay = document.getElementById('chatBotOverlay');
    const container = document.getElementById('chatbotContainer');
    const chatContent = document.getElementById('chatContent');
    
    chatContent.innerHTML = '';
    addMessageToChat('bot', "Olá, eu sou o **BenzaBot**, estou aqui para te ajudar com suas dúvidas institucionais. Qual é a sua pergunta?");
    
    overlay.style.display = 'flex';
    document.getElementById('sidebar').classList.remove('open');
    document.querySelectorAll('.page-container').forEach(el => el.classList.remove('active'));
    setTimeout(() => { container.classList.add('active'); }, 10);
}

function closeChatBotAndGoHome() {
    const overlay = document.getElementById('chatBotOverlay');
    const container = document.getElementById('chatbotContainer');
    
    container.classList.remove('active');
    
    setTimeout(() => {
        overlay.style.display = 'none';
        changePage(1);
    }, 500);
}

// --- LÓGICA DE TRANSIÇÃO (VERSÃO CORRIGIDA E ESTÁVEL) ---

function changePage(nextPage) {
    if (nextPage < 1 || nextPage > totalPages) return;
    
    const currentContainer = document.getElementById(`page${currentPage}`);
    const nextContainer = document.getElementById(`page${nextPage}`);
    
    if (!currentContainer || !nextContainer) {
        console.error(`Erro de Navegação: Página ${currentPage} ou ${nextPage} não encontrada.`);
        currentPage = nextPage;
        nextContainer?.classList.add("active");
        return;
    }

    document.getElementById('chatBotOverlay').style.display = 'none';
    document.getElementById('chatbotContainer').classList.remove('active');
    document.getElementById('sidebar').classList.remove('open');
    
    currentContainer.classList.remove('active');
    
    if (currentPage === 2) {
        document.querySelectorAll('#page2 .form-field').forEach(el => {
            el.classList.add('exit');
        });
    }

    setTimeout(() => {
        currentContainer.style.display = 'none';
        nextContainer.style.display = 'block';
        void nextContainer.offsetWidth; 
        nextContainer.classList.add('active');
        currentPage = nextPage;

        if (nextPage === 2) {
            resetFormFields(); 
            
            document.querySelectorAll('#page2 .form-field').forEach((el) => {
                el.classList.remove('exit'); 
                el.style.animation = 'none';
                el.offsetHeight; /* aciona reflow */
                el.style.animation = null;  
            });
        }
        
        if (nextPage === 3) {
            updateStarDisplay(); // <-- Inicializa as estrelas
        }

    }, 500); 
}


/**
 * Inicialização da assinatura (mantida como função)
 */
function initializeTypewriter() {
    const footerSpan = document.getElementById('typewriter-text');
    footerSpan.style.width = 'auto'; 
    console.log("Animação Typewriter desativada. Assinatura fixa.");
}


/**
 * (CORRIGIDO) Gerencia a animação de carregamento, envia os dados para o Azure e muda para a página 3.
 * É a função de "Montar JSON" e "Chamar Logic App".
 * @param {number} nextPage O número da página de destino (deve ser 3).
 */
async function loadAndChangePage(nextPage) {
    if (nextPage !== 3) return changePage(nextPage);
    if (isProcessing) return;

    const loadingOverlay = document.getElementById('loadingOverlay');
    const responseBox = document.getElementById('responseBox');

    // 1. Geração e Validação do JSON (Objeto)
    const tagsString = document.getElementById('tags').value.trim();

    const data = {
        protocolo: document.getElementById('protocolo').value.trim(),
        pergunta: document.getElementById('perguntaAluno').value.trim(),
        tags: tagsString, // Envia como string
        sazonalidade: document.getElementById('sazonalidade').value.trim(),
        tom: document.getElementById('tom').value.trim(),
        equipe: document.getElementById('equipe').value,
        feedback: 0
    };

    // --- INÍCIO DA VALIDAÇÃO APRIMORADA ---
    if (!data.protocolo) {
        window.alert("Por favor, preencha o campo Protocolo.");
        return;
    }
    if (!data.pergunta) {
        window.alert("Por favor, preencha o campo Pergunta do Aluno(a).");
        return;
    }
    
    // Tags agora são opcionais, então a validação foi removida.

    if (!data.equipe || data.equipe === "") { 
        window.alert("Por favor, selecione uma Equipe.");
        return;
    }
    // --- FIM DA VALIDAÇÃO APRIMORADA ---

    isProcessing = true;
    changePage(nextPage);
    loadingOverlay.style.display = 'flex';
    responseBox.textContent = "Processando no Azure... aguarde.";

    try {
        const response = await fetch(PROCESS_FORM_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json(); 

        if (!response.ok) {
            if (result && result.status === "rejeitado_cache_vazio") {
                alert("Nenhum conteúdo institucional foi encontrado para as tags fornecidas. Por favor, revise a pergunta ou selecione outra equipe.");
                changePage(2); 
                return; 
            }
            throw new Error(result.erro || result.message || `Erro na requisição: ${response.status}`);
        }

        if (result && result.respostaEstilizada) {
            currentResponseData.equipe = data.equipe;
            currentResponseData.hash = result.hash;
            displayResponse(result.respostaEstilizada);
        } else {
            throw new Error("Resposta de sucesso incompleta ou inválida do Azure.");
        }

    } catch (error) {
        console.error("[ERRO AZURE PROCESSAMENTO]", error);
        displayResponse(`🚫 ERRO INSTITUCIONAL: Falha ao processar a resposta. Detalhes: ${error.message}. Por favor, verifique o protocolo e tente novamente.`);
    } finally {
        loadingOverlay.style.display = 'none';
        isProcessing = false;
    }
}


// --- EXPOSIÇÃO GLOBAL E INICIALIZAÇÃO ---

window.filterProtocol = filterProtocol;
window.toggleSidebar = toggleSidebar;
window.changePage = changePage;
window.loadAndChangePage = loadAndChangePage;
window.copyResponse = copyResponse;
window.sendFeedback = sendFeedback;
window.openChatBot = openChatBot;
window.closeChatBotAndGoHome = closeChatBotAndGoHome;
window.simulateUserMessage = simulateUserMessage;
window.initializeTypewriter = initializeTypewriter;
window.handleStarClick = handleStarClick;
window.handleStarMouseOver = handleStarMouseOver;
window.handleStarMouseOut = handleStarMouseOut;
window.updateStarDisplay = updateStarDisplay;
window.resetRating = resetRating;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    changePage(1); 
    initializeTypewriter();
});