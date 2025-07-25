const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const delay = ms => new Promise(res => setTimeout(res, ms));
const fs = require('fs');
const readline = require('readline');

require('dotenv').config(); // Carrega as variáveis do arquivo .env

// --- CONSTANTES DE CONFIGURAÇÃO ---
const USER_STATE_FILE = 'userState.json';
const HUMAN_LIKE_DELAY_MS = process.env.HUMAN_LIKE_DELAY_MS || 1500;
const DELETION_DELAY_MS = process.env.DELETION_DELAY_MS || 5000;
const RESET_STATE_AFTER_MS = process.env.RESET_STATE_AFTER_MS || 48 * 60 * 60 * 1000; // 48 horas
const INACTIVITY_REMINDER_MS = process.env.INACTIVITY_REMINDER_MS || 60 * 60 * 1000; // 60 minutos
let userState = {};

// --- DECLARAÇÃO E INICIALIZAÇÃO DO CLIENTE ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    }
});

const processingUsers = new Set();

// --- FUNÇÕES AUXILIARES ---
function loadUserState() {
    if (fs.existsSync(USER_STATE_FILE)) {
        try {
            const data = fs.readFileSync(USER_STATE_FILE, 'utf8');
            userState = JSON.parse(data);
            console.log('Estado dos usuários carregado com sucesso.');
        } catch (error) {
            console.error('Erro ao carregar o estado dos usuários:', error);
            userState = {};
        }
    } else {
        console.log('Arquivo de estado dos usuários não encontrado. Iniciando com estado vazio.');
    }
}

function saveUserState() {
    const tempFile = `${USER_STATE_FILE}.tmp`;
    try {
        fs.writeFileSync(tempFile, JSON.stringify(userState, null, 2), 'utf8');
        fs.renameSync(tempFile, USER_STATE_FILE);
    } catch (error) {
        console.error('ERRO GRAVE AO SALVAR O ESTADO DOS USUÁRIOS:', error);
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
    }
}

function normalizeNumberInput(input) {
    const map = {
        '1': ['1', '1️⃣'], '2': ['2', '2️⃣'], '3': ['3', '3️⃣'], '4': ['4', '4️⃣'],
        '5': ['5', '5️⃣'], '6': ['6', '6️⃣'], '7': ['7', '7️⃣'], '8': ['8', '8️⃣'],
        '9': ['9', '9️⃣']
    };
    return map[input] || [input];
}

function cleanupInactiveUsers() {
    console.log('[ROTINA] Executando limpeza de usuários inativos (48h)...');
    const now = Date.now();
    let usersRemoved = 0;
    for (const user in userState) {
        if (userState[user].lastInteraction && (now - userState[user].lastInteraction > RESET_STATE_AFTER_MS)) {
            console.log(`[ROTINA] Removendo usuário inativo (48h): ${user}`);
            delete userState[user];
            usersRemoved++;
        }
    }
    if (usersRemoved > 0) {
        console.log(`[ROTINA] ${usersRemoved} usuário(s) inativo(s) removido(s).`);
        saveUserState();
    } else {
        console.log('[ROTINA] Nenhum usuário inativo (48h) para remover.');
    }
}

async function checkUserInactivity() {
    const now = Date.now();
    console.log('[ROTINA] Verificando inatividade de clientes (60 min)...');
    for (const user in userState) {
        const state = userState[user];
        if (state.promptedForMenu && state.promptTimestamp && (now - state.promptTimestamp > INACTIVITY_REMINDER_MS)) {
            if (state.reminderSent) {
                console.log(`[INATIVIDADE] Usuário ${user} excedeu o segundo tempo limite. Encerrando atendimento.`);
                await client.sendMessage(user, respostasComuns.encerramentoInatividade);
                delete userState[user];
                saveUserState();
            } else {
                console.log(`[INATIVIDADE] Usuário ${user} está inativo. Enviando primeiro lembrete.`);
                await client.sendMessage(user, respostasComuns.lembreteInatividade);
                state.reminderSent = true;
                state.promptTimestamp = Date.now();
                saveUserState();
            }
        }
    }
}

// --- MENUS E CONTEÚDOS ---
function menuPrincipal() {
    return (
`🚍 *DP EVENTOS TUR*
Conectando você aos melhores eventos do Brasil! 🛣️

👋🏼 *Olá! Seja bem-vindo(a).*
Digite o número para saber mais:

🚌 *Excursões Disponíveis*
1️⃣ - Festa do Peão de Barretos
2️⃣ - Jaguariúna Rodeo Festival
3️⃣ - Federal Fantasy - Alfenas
4️⃣ - Réveillon Copacabana 2026

💳 *Reservas e Pagamentos*
5️⃣ - Informações sobre minha reserva
6️⃣ - Fazer Pagamentos

👨🏻‍💻 *Dúvidas e Suporte*
7️⃣ - Falar com atendente
_____________________________`
    );
}

function menuBarretos() {
    return (
`🤠 *Festa do Peão de Barretos 2025*
Digite o número para saber mais:

📋 *Informativo Completo*
1️⃣ - Receba todas Informações

🔍 *Informações Detalhadas:*
2️⃣ - Datas・Embarques・Horários
3️⃣ - Transporte・Open Bar
4️⃣ - Ingressos Barretos

💳 *Reservas e Pagamento*
5️⃣ - Formas de Pagamento
6️⃣ - Reservar minha Vaga

👨🏻‍💻 *Dúvidas e Suporte*
7️⃣ - Falar com Atendente

⚙️ *Opções de Navegação*
8️⃣ - Voltar ao Menu Principal
9️⃣ - Encerrar Atendimento`
    );
}

function menuJaguariuna() {
    return (
`🤠 *Jaguariúna Rodeo Festival 2025*
Digite o número para saber mais:

📋 *Informativo Completo*
1️⃣ - Receba todas Informações

🔍 *Informações Detalhadas:*
2️⃣ - Datas・Embarques・Horários
3️⃣ - Transporte・Open Bar
4️⃣ - Ingressos Jaguariúna

💳 *Reservas e Pagamento*
5️⃣ - Formas de Pagamento
6️⃣ - Reservar minha Vaga

👨🏻‍💻 *Dúvidas e Suporte*
7️⃣ - Falar com Atendente

⚙️ *Opções de Navegação*
8️⃣ - Voltar ao Menu Principal
9️⃣ - Encerrar Atendimento`
    );
}

function menuFederalFantasy() {
    return (
`🎭 *Federal Fantasy 2025*
Digite o número para saber mais:

📋 *Informativo Completo*
1️⃣ - Receba todas Informações

🔍 *Informações Detalhadas:*
2️⃣ - Datas・Embarques・Horários
3️⃣ - Transporte・Open Bar
4️⃣ - Ingressos Federal Fantasy

💳 *Reservas e Pagamento*
5️⃣ - Formas de Pagamento
6️⃣ - Reservar minha Vaga

👨🏻‍💻 *Dúvidas e Suporte*
7️⃣ - Falar com Atendente

⚙️ *Opções de Navegação*
8️⃣ - Voltar ao Menu Principal
9️⃣ - Encerrar Atendimento`
    );
}

function menuReveillon() {
    return (
`🎆 *Réveillon Copacabana 2026*
Digite o número para saber mais:

📋 *Informativo Completo*
1️⃣ - Receba todas Informações

🔍 *Informações Detalhadas:*
2️⃣ - Datas・Embarques・Horários
3️⃣ - Transporte・Open Bar

💳 *Reservas e Pagamento*
4️⃣ - Formas de Pagamento
5️⃣ - Reservar minha Vaga

👨🏻‍💻 *Dúvidas e Suporte*
6️⃣ - Falar com Atendente

⚙️ *Opções de Navegação*
7️⃣ - Voltar ao Menu Principal
8️⃣ - Encerrar Atendimento`
    );
}

const conteudoEventos = {
    federalFantasy: {
        shows:
`🎭 *Federal Fantasy 2025 com a DP Eventos!*

🌟 Entre em um mundo de fantasia e aventura nesse festival único. Curta 12 horas de open bar e mega atrações!
_____________________________

➡️ *SÁBADO, 27 DE SETEMBRO*

🎶 *LINE-UP CONFIRMADO!* 🎶
🎤 🎚️ Ivete Sangalo - Felipe Amorim - Livinho - L7nnon - DJ GBR - Fialho

🔔 As atrações são divulgadas gradualmente pelo próprio organizador do evento. Fique de olho! Assim que novas atrações forem anunciadas, informaremos por aqui. 😉`,
        embarque:
`➡️ *EMBARQUES*
📍14h30 - Rod. Nova Jacareí.
📍14h50 - Tenda Vale Sul SJC.
📍15h00 - Posto Shell CTA SJC.
📍15h20 - Simpatia Shell Caçapava.
📍15h50 - Rod. Nova Taubaté.
📍16h40 - Posto Grillo St Ant do Pinhal.

⏳ *PARADA:*
🕗 No Restaurante Fernandão - Cardápio variado e vestiário para finalização e troca de roupa.

🏁 *CHEGADA*
🕗 22h00 - Previsão de chegada na Federal Fantasy. Podendo esse horário ser estendido devido a atrasos nos embarques e trânsito, por exemplo.

🚌 *RETORNO*
🕗 08h00 - Previsão de retorno: 45 minutos após o término do show.`,
        transportes:
`⬇️ *INFORMAÇÕES TRANSPORTE*

🚌 Ônibus Executivo
❄️ Ar-condicionado
🚻 Banheiro
🍻 Serviço de Open Bar (opcional)
🎟️ Ingresso Federal (opcional)
👨🏻‍💼 Monitores

💳 *R$220,00 - TRANSPORTE*
Valor sem o serviço de open bar incluso.

⚠️ *Informação importante:*
O valor acima *NÃO INCLUI* o serviço de open bar. Portanto, não será permitido embarcar com ou consumir bebidas alcoólicas dentro do ônibus, sendo autorizado apenas o consumo de água. Caso deseje consumir bebida alcoólica, será necessário contratar o serviço de open bar.`,
        openbar:
`➡️ *SERVIÇO DE OPEN BAR:*
💳 *R$40,00 - Valor do serviço*

*Bebidas inclusas:*
🍺 Cerveja: Budweiser ou similar
🍸 Vodka: Smirnoff ou similar
🍹 Gin: Theros ou similar
⚡ Baly: (tradicional, melancia e tropical)
🧊 Refrigerante, água, gelo, copos e canudos

⏰ *Início do serviço:* Após o último embarque

⏳ *Duração:* Todo o trajeto de ida até Federal Fantasy.

✅ *Leve sua bebida favorita:* Com o serviço de open bar ativo, além de aproveitar todas as bebidas disponíveis, você ainda pode embarcar com bebidas adicionais de sua preferência.`,
        ingressos:
`➡️ *INGRESSOS FEDERAL FANTASY*
Garanta seu ingresso *Federal Fantasy* com a DP Eventos! 🎟️✨

💳 *PISTA VIP: R$180,00*
*Incluso:* Open Bar de Cerveja, Vodka, Coquetel Alcoólico, Refri e Suco.

💳 *FRONT STAGE: R$250,00*
*Incluso:* Open Bar de Cerveja, Vodka, Gin, Coquetel Alcoólico, Refri, Água e Suco.

💳 *CAMAROTE: R$360,00*
*Incluso:* Cerveja, Água, Refrigerante, Coquetel alcoólico, Gin, Suco, Whisky, Vodka e Energético.

⚠️ *Os valores dos ingressos estão sujeitos à alteração conforme o lote vigente na hora da solicitação.*`,
        pagamento:
`➡️ *FORMAS DE PAGAMENTOS:*

💸 *PIX:* Pagamento à vista ou parcelado:

→ Até 3x sem juros:
▪️ 1ª parcela: no ato da reserva
↳ Parcelas restantes: pagas mensalmente nos meses seguintes.

💳 *Cartão de Crédito:*
→ Até 6x sem juros
→ 7x a 12x: com juros (taxa variável – consulte)`
    },
    barretos: {
        shows:
            ` 🤠 *Festa do Peão de Barretos 2025 com a DP Eventos!*

🌟 Viva a emoção do rodeio mais tradicional da América Latina!
_____________________________

➡️ *SÁBADO, 23 DE AGOSTO*
*Palco Estádio:* Ana Castela / Zé Neto & Cristiano / Nattan.

*Palco Amanhecer:* Guilherme e Benuto / Maria Cecilia & Rodolfo / Léo & Raphael / Diego e Arnaldo / Jirayauai.

➡️ *SÁBADO, 30 DE AGOSTO*
*Palco Estádio:* Jorge & Mateus / Edson & Hudson / César Menotti & Fabiano / Rionegro & Solimões.

*Palco Amanhecer:* Trio Parada Dura / Fiduma e Jeca / Bruno Rosa.`,
        embarque:
            ` ⬇️ *PONTOS DE EMBARQUE*

📍 07h30 - Rod. Guaratinguetá
📍 07h40 - Rod. Aparecida
📍 08h10 - Spani Pindamonhangaba
📍 08h40 - Rod. Nova Taubaté
📍 09h00 - Ponto Nestlé Caçapava
📍 09h50 - Rod. Nova SJC
📍 10h15 - Posto Gruta SJC
📍 10h30 - Rod. Nova Jacareí
📍 11h00 - Posto Portal Igaratá

⏳ *Parada:*
🕗 14h30 - 16h30 no Restaurante Castelo Plaza (alimentação, troca de roupa e opção de banho)

🏁 *Chegada:*
🕗 20h00 - Previsão de chegada em Barretos. Podendo esse horário ser estendido devido a atrasos nos embarques e trânsito, por exemplo.

🚌 *Retorno:*
🕗 07h00 - Saída 45 minutos após o término do show`,
        transportes:
            ` ⬇️ *INFORMAÇÕES TRANSPORTE*

🚌 Ônibus Executivo
❄️ Ar-condicionado
🚻 Banheiro
🍻 Serviço de Open Bar (opcional)
👨🏻‍💼 Monitores

💳 *R$340,00 - Embarque A*
📍 Taubaté 📍 Caçapava
📍 São José dos Campos
📍 Jacareí 📍 Igaratá

💳 *R$355,00 - Embarque B*
📍 Pindamonhangaba

💳 *R$380,00 - Embarque C*
📍 Guaratinguetá 📍 Aparecida

⚠️ O valor *não inclui* o serviço de open bar. Portanto, não será permitido embarcar ou consumir bebidas alcoólicas dentro do ônibus sem a contratação do serviço de open bar. Água é liberada.`,
        openbar:
            ` ⬇️ *SERVIÇO DE OPEN BAR*
🍻 *R$50,00 - Valor do serviço*

*Bebidas inclusas:*
🍺 Cerveja: Budweiser ou similar
🥃 Whisky: Red Label ou similar
🍸 Vodka: Smirnoff ou similar
🍹 Gin: Theros ou similar
⚡ Baly: (tradicional, melancia e tropical)
🧊 Refrigerante, água, gelo, copos e canudos

⏰ *Início do serviço:* Após o último embarque

⏳ *Duração:* Todo o trajeto de ida até Barretos

✅ *Bebidas adicionais:* Permitido levar para consumo pessoal`,
        ingressos:
            ` ⬇️ *INGRESSOS BARRETOS*
Compre seu ingresso no site oficial.

🔗 *Link para compra:*
https://cart.totalacesso.com/70festadopeaodeboiadeirodebarretos2025

🎟️ *Parque / Rodeio / Show - Meia:*
▪️ R$205,00 ~ R$300,00
  
🎟️ *Parque / Rodeio / Show - Solidário:*
▪️ R$280,00 ~ R$380,00

*Outros Setores:* (Solicitar consulta)

・ O ingresso solidário dá acesso igual ao ingresso inteira.

・ Para aquisição do ingresso meia-entrada, é obrigatório o cadastro do beneficiário e a validação do documento no site da Total Acesso.`,
        pagamento:
            ` ➡️ *FORMAS DE PAGAMENTO*

💸 *PIX:*
Pagamento à vista ou parcelado:

→ Até 2x sem juros:
▪️ 1ª parcela: no ato da reserva
↳ Parcelas restantes: pagas mensalmente nos meses seguintes.

💳 *Cartão de Crédito:*
→ Até 6x sem juros
→ 7x a 12x: com juros (taxa variável – consulte)`
    },
    jaguariuna: {
        shows:
            ` 🤠 *Jaguariúna Rodeo Festival 2025 com a DP Eventos!*

🌟 Prepare-se para rodeios emocionantes, shows imperdíveis e muita festa nesse tradicional evento!
_____________________________

➡️ *SEXTA, 19 de SETEMBRO*
Chitãozinho & Xororó / Murilo Huff / Felipe & Rodrigo / Lauana Prado.

➡️ *SÁBADO, 20 de SETEMBRO*
Jorge & Mateus / Luan Santana / em breve mais 2 atrações.

➡️ *SEXTA, 26 de SETEMBRO*
Bruno & Marrone / Ana Castela / Natanzinho / em breve mais 1 atração.

➡️ *SÁBADO, 27 de SETEMBRO*
Kacey Musgraves / Zé Neto & Cristiano / Nattan / em breve mais 1 atração.

🔔 As atrações são divulgadas gradualmente pelo próprio organizador do evento. Fique de olho!
Assim que novas atrações forem anunciadas, informaremos por aqui. 😉`,
        embarque:
            ` ➡️ *EMBARQUES: SEXTAS-FEIRAS*
📍 16h20 - Rod. Guaratinguetá
📍 16h30 - Rod. Aparecida
📍 17h00 - Spani Pindamonhangaba
📍 17h10 - Rod. Nova Taubaté
📍 17h30 - Ponto Nestlé Caçapava
📍 18h30 - Rod. Nova SJC
📍 18h40 - Posto Gruta SJC
📍 19h00 - Rod. Nova Jacareí
📍 19h30 - Posto Portal Igaratá

➡️ *EMBARQUES: SÁBADOS*
📍 15h20 - Rod. Guaratinguetá
📍 15h30 - Rod. Aparecida
📍 16h00 - Spani Pindamonhangaba
📍 16h10 - Rod. Nova Taubaté
📍 16h30 - Ponto Nestlé Caçapava
📍 17h30 - Rod. Nova SJC
📍 17h40 - Posto Gruta SJC
📍 18h00 - Rod. Nova Jacareí
📍 18h30 - Posto Portal Igaratá

ℹ️ Para atender a todos, especialmente aqueles que trabalham na sexta-feira, os embarques das sextas-feiras sairão uma hora mais tarde, levando em consideração os horários de sábado.

⏳ *Parada:*
🕗 Restaurante Graal Mirante - cardápio variado e vestiário para troca de roupa

🏁 *Chegada:*
🕗 21h30 - Previsão em Jaguariúna. Podendo esse horário ser estendido devido a atrasos nos embarques e trânsito, por exemplo.

🚌 *Retorno:*
🕗 07h00 - Saída 45 minutos após o término do show`,
        transportes:
            ` ⬇️ *INFORMAÇÕES TRANSPORTE*

🚌 Ônibus Executivo
❄️ Ar-condicionado
🚻 Banheiro
🍻 Serviço de Open Bar (opcional)
🎟️ Ingresso Jaguariúna (opcional)
👨🏻‍💼 Monitores

💳 *R$190,00 - Embarque A*
📍 Taubaté 📍 Caçapava
📍 São José dos Campos
📍 Jacareí 📍 Igaratá

💳 *R$205,00 - Embarque B*
📍 Pindamonhangaba

💳 *R$230,00 - Embarque C*
📍 Guaratinguetá 📍 Aparecida

⚠️ *Importante:*
O valor *não inclui* o serviço de open bar. Portanto, não será permitido embarcar ou consumir bebidas alcoólicas dentro do ônibus sem a contratação do serviço de open bar. Água é liberada.`,
        openbar:
            ` ⬇️ *SERVIÇO DE OPEN BAR*
🍻 *R$40,00 - Valor do serviço*

*Bebidas inclusas:*
🍺 Cerveja: Budweiser ou similar
🍸 Vodka: Smirnoff ou similar
🍹 Gin: Theros ou similar
⚡ Baly: (tradicional, melancia e tropical)
🧊 Refrigerante, água, gelo, copos e canudos

⏰ *Início do serviço:* Após o último embarque

⏳ *Duração:* Todo o trajeto de ida até Jaguariúna

✅ *Bebidas adicionais:* Permitido levar para consumo pessoal`,
        ingressos:
            ` ⬇️ *INGRESSOS JAGUARIÚNA*
Garanta seu ingresso Arena Meia com a DP Eventos! 🎟️✨

🎟️ *SEXTA, 19 de SETEMBRO*
▪️ R$33,60 - Arena Meia

🎟️ *SÁBADO, 20 de SETEMBRO*
▪️ R$123,20 - Arena Meia

🎟️ *SEXTA, 26 de SETEMBRO*
▪️ R$33,60 - Arena Meia

🎟️ *SÁBADO, 27 de SETEMBRO*
▪️ R$67,20 - Arena Meia

*Outros Setores:* Para ingressos inteira ou camarote, acesse o site da Total Acesso.

⚠️ Valores sujeitos a alteração conforme lote vigente.`,
        pagamento:
            ` ➡️ *FORMAS DE PAGAMENTOS:*

💸 *PIX:*
Pagamento à vista ou parcelado:

→ Até 3x sem juros:
▪️ 1ª parcela: no ato da reserva
↳ Parcelas restantes: pagas mensalmente nos meses seguintes.

💳 *Cartão de Crédito:*
→ Até 6x sem juros
→ 7x a 12x: com juros (taxa variável – consulte)`
    },
    reveillon: {
        shows:
            ` 🥂 *Réveillon Copacabana 2026 com a DP Eventos!*
  
🌟 Celebre o ano novo em grande estilo, no maior Réveillon do Brasil, com shows, queima de fogos e muita energia!
_____________________________

➡️ *PROGRAMAÇÃO:*
🎤 Shows: Em breve

🎆 12 minutos de queima de fogos.

✅ Acesso aos shows são gratuitos.

🔔 As atrações são divulgadas gradualmente pela Prefeitura do Rio. Fique de olho! Assim que atrações forem confirmadas, informaremos por aqui. 😉`,
        embarque:
            ` ➡️ *EMBARQUES: 31 de DEZEMBRO*

📍 11h00 - Rod. Nova Jacareí
📍 11h20 - Tenda Vale Sul SJC
📍 11h40 - Posto Shell CTA SJC
📍 12h00 - Simpatia Shell Caçapava
📍 12h20 - Rod. Nova Taubaté
📍 12h40 - Spani Pindamonhangaba
📍 13h20 - Rod. Guaratinguetá
📍 13h40 - Chevrolet Lorena

⏳ *PARADA:*
🕗 16h00 - Parada no restaurante Graal Resende - Cardápio variado e vestiário para finalização e troca de roupa.

🏁 *CHEGADA*
🕗 18h30 - Previsão de chegada em Copacabana. Podendo esse horário ser estendido devido a atrasos nos embarques e trânsito, por exemplo.

🚌 *RETORNO*
🕗 06h00 - Previsão de retorno: Após liberação dos acessos pela fiscalização em Copacabana.`,
        pacote:
            ` ➡️ *INFORMAÇÕES TRANSPORTE:*

🚌 Ônibus Executivo
❄️ Ar-condicionado
🚻 Banheiro
🍻 Serviço de Open Bar (opcional)
👨🏻‍💼 Monitores`,
        openbar:
            ` ⬇️ *SERVIÇO DE OPEN BAR*
🍻 *R$40,00 - Valor do serviço*

*Bebidas inclusas:*
🍺 Cerveja: Budweiser ou similar
🍸 Vodka: Smirnoff ou similar
🍹 Gin: Theros ou similar
⚡ Baly: (tradicional, melancia e tropical)
🧊 Refrigerante, água, gelo, copos e canudos
  
⏰ *Início do serviço:* Após o último embarque

⏳ *Duração:* Todo o trajeto de ida até Copacabana

✅ *Bebidas adicionais:* Permitido levar para consumo personal`,
        transportes:
            `💳 *R$280,00 - Valor do transporte*

⚠️ *Importante:*
O valor *não inclui* o serviço de open bar. Portanto, não será permitido embarcar ou consumir bebidas alcoólicas dentro do ônibus sem a contratação do serviço de open bar. Água é liberada.`,
        pagamento:
            ` ➡️ *FORMAS DE PAGAMENTOS:*

💸 *PIX:* Pagamento à vista ou parcelado:

→ Até 4x sem juros:
▪️ 1ª parcela: no ato da reserva
↳ Parcelas restantes: pagas mensalmente nos meses seguintes.

💳 *Cartão de Crédito:*
→ Até 6x sem juros
→ 7x a 12x: com juros (taxa variável – consulte)`
    }
};

const respostasComuns = {
    reservar: `✅ Sua solicitação de reserva foi registrada!\n\n🧑🏻‍💻Um de nossos atendentes entrará em contato em breve para finalizar sua reserva.`,
    atendente: `🧑🏻‍💻 Por gentileza, aguarde. Um de nossos atendentes dará continuidade ao seu atendimento.\n\nPara voltar ↩️ ao menu, digite *Menu*.`,
    encerrar: `👋🏻 Atendimento encerrado. Sempre que precisar, é só chamar por aqui que retomamos seu atendimento.\n\nDP Eventos agradece seu contato. 💙`,
    voltar: `🔁 Voltando ao Menu Principal...`,
    invalido: `⚠️ Opção inválida. Por gentileza, digite um número da lista.`,
    desconhecido: `👨🏻‍💻 Olá! Não entendi sua mensagem. Por gentileza, digite o número da opção desejada no *Menu* abaixo.`,
    promptMenu: `*Por favor escolha uma opção:*\n1️⃣ - Voltar ao Menu. ↩️\n2️⃣ - Falar com um Atendente. 👨🏻‍💻\n0️⃣ - Encerrar Atendimento. 😢`,
    avisoApagarMenu: `🗑️ Os *Menus* são apagados, mas as informações importantes permanecem visíveis no atendimento. 😉`,
    lembreteInatividade: `👋🏼 *Oi! Ainda está por aqui?* 👀\nEscolha uma das opções para seguir com o atendimento ou finalizar. ✅`,
    encerramentoInatividade: `👨🏻‍💻 *Por falta de comunicação encerramos o atendimento.* 😢\nSempre que precisar, é só chamar por aqui que retomamos seu atendimento.\n\nDP Eventos agradece seu contato. 💙`
};

// --- INICIALIZAÇÃO DO CLIENTE ---
loadUserState();

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', async () => {
    console.log('DP Eventos conectado com sucesso!');

    console.log('[SISTEMA] Verificando mensagens não lidas para continuar atendimentos...');
    
    const chats = await client.getChats();
    for (const chat of chats) {
        if (chat.unreadCount > 0 && !chat.isGroup) {
            const user = chat.id._serialized;
            console.log(`[RECUPERAÇÃO] Encontradas ${chat.unreadCount} mensagens não lidas de ${user}.`);
            
            const messages = await chat.fetchMessages({ limit: 1 });
            if (messages.length > 0) {
                const lastMessage = messages[0];
                if (lastMessage && !lastMessage.fromMe) {
                    console.log(`[RECUPERAÇÃO] Processando a última mensagem de ${user} para continuar ou iniciar atendimento.`);
                    await processMessage(lastMessage);
                    await delay(HUMAN_LIKE_DELAY_MS);
                }
            }
        }
    }
    console.log('[SISTEMA] Verificação de mensagens não lidas concluída.');

    console.log('[SISTEMA] Agendando rotinas de fundo...');
    setInterval(cleanupInactiveUsers, 60 * 60 * 1000);
    setInterval(checkUserInactivity, 60 * 1000);

    startConsoleCommands();
});

client.on('disconnected', (reason) => {
    console.log('Cliente foi desconectado:', reason);
});

client.initialize();

// ######################################################################
// ### FUNÇÃO DE PROCESSAMENTO DE MENSAGEM (EXTRAÍDA CORRETAMENTE)    ###
// ######################################################################
async function processMessage(msg) {
    const from = msg.from;

    if (processingUsers.has(from)) {
        return;
    }
    
    processingUsers.add(from);

    try {
        const chat = await msg.getChat();
        if (chat.isGroup || msg.from === 'status@broadcast') {
            return; 
        }

        console.log(`--------------------------------------------------`);
        console.log(`[LOG] Mensagem recebida de: ${from}`);
        console.log(`[LOG] Conteúdo: "${msg.body}"`);

        const texto = msg.body.toLowerCase().trim();

        if (!userState[from]) {
            userState[from] = { 
                stage: null, 
                atendimentoHumano: false, 
                initialGreetingSent: false, 
                lastMenuMessageId: null,
                promptedForMenu: false, 
                promptTimestamp: null,
                reminderSent: false 
            };
        }
        const estadoAtual = userState[from];
        
        estadoAtual.lastInteraction = Date.now();
        
        const deleteLastMenuMessage = async () => {
            if (estadoAtual.lastMenuMessageId) {
                const msgToDeleteId = estadoAtual.lastMenuMessageId;
                estadoAtual.lastMenuMessageId = null; 
                await delay(DELETION_DELAY_MS);
                try {
                    const msgToDelete = await client.getMessageById(msgToDeleteId);
                    if (msgToDelete) await msgToDelete.delete(true);
                } catch (e) {
                    console.log(`[ERRO] Falha ao apagar a mensagem de menu anterior: ${e.message}`);
                }
            }
        };

        const sendAndStoreMenu = async (menuFunction) => {
            const lastMenuId = estadoAtual.lastMenuMessageId;
            const sentMsg = await client.sendMessage(from, menuFunction());
            
            if (menuFunction !== menuPrincipal) { 
                estadoAtual.lastMenuMessageId = sentMsg.id._serialized;
            } else {
                estadoAtual.lastMenuMessageId = null;
            }

            if (lastMenuId) {
                await delay(DELETION_DELAY_MS);
                try {
                    const msgToDelete = await client.getMessageById(lastMenuId);
                    if (msgToDelete) await msgToDelete.delete(true);
                } catch (e) {
                     console.log(`[ERRO] Falha ao apagar a mensagem de menu anterior: ${e.message}`);
                }
            }
        };
        
        const resetInactivityState = () => {
            estadoAtual.promptedForMenu = false;
            estadoAtual.promptTimestamp = null;
            estadoAtual.reminderSent = false;
        };

        const palavrasChave = ['menu'];
        if (palavrasChave.includes(texto)) {
            let menuToSendFunction = menuPrincipal;
            let shouldResetStage = true;

            if (estadoAtual.stage && ['barretos', 'jaguariuna', 'federalFantasy', 'reveillon'].includes(estadoAtual.stage)) {
                switch (estadoAtual.stage) {
                    case 'barretos': menuToSendFunction = menuBarretos; break;
                    case 'jaguariuna': menuToSendFunction = menuJaguariuna; break;
                    case 'federalFantasy': menuToSendFunction = menuFederalFantasy; break;
                    case 'reveillon': menuToSendFunction = menuReveillon; break;
                }
                shouldResetStage = false; 
            }

            if (shouldResetStage) {
                estadoAtual.stage = null;
            }

            estadoAtual.atendimentoHumano = false;
            estadoAtual.initialGreetingSent = true;
            resetInactivityState();
            
            await delay(HUMAN_LIKE_DELAY_MS);
            await sendAndStoreMenu(menuToSendFunction);
            saveUserState();
            return;
        }

        const isOption1 = normalizeNumberInput('1').includes(texto);
        const isOption2 = normalizeNumberInput('2').includes(texto);
        const isOption3 = normalizeNumberInput('3').includes(texto);
        const isOption4 = normalizeNumberInput('4').includes(texto);
        const isOption5 = normalizeNumberInput('5').includes(texto);
        const isOption6 = normalizeNumberInput('6').includes(texto);
        const isOption7 = normalizeNumberInput('7').includes(texto);
        const isOption8 = normalizeNumberInput('8').includes(texto);
        const isOption9 = normalizeNumberInput('9').includes(texto);
        const isOption0 = texto.trim() === '0';

        if (estadoAtual.atendimentoHumano) {
            return;
        }

        if (estadoAtual.stage === null) {
            if (!estadoAtual.initialGreetingSent) {
                console.log(`[AÇÃO] Enviando primeiro menu principal para novo usuário.`);
                await delay(HUMAN_LIKE_DELAY_MS);
                await sendAndStoreMenu(menuPrincipal);
                estadoAtual.initialGreetingSent = true;
                saveUserState();
                return;
            }

            console.log(`[FLUXO] Usuário no Menu Principal.`);
            await delay(HUMAN_LIKE_DELAY_MS);
            if (isOption1) {
                estadoAtual.stage = 'barretos';
                await sendAndStoreMenu(menuBarretos);
            } else if (isOption2) {
                estadoAtual.stage = 'jaguariuna';
                await sendAndStoreMenu(menuJaguariuna);
            } else if (isOption3) {
                estadoAtual.stage = 'federalFantasy';
                await sendAndStoreMenu(menuFederalFantasy);
            } else if (isOption4) {
                estadoAtual.stage = 'reveillon';
                await sendAndStoreMenu(menuReveillon);
            } else if (isOption5 || isOption6 || isOption7) {
                await deleteLastMenuMessage();
                estadoAtual.atendimentoHumano = true;
                let msgAtendente = respostasComuns.atendente;
                if(isOption5) msgAtendente = `📬 *Sobre minha reserva*\nPor gentileza, descreva o que deseja saber sobre sua reserva. Um de nossos atendentes responderá em breve.\n\n↩️ Para voltar ao menu, digite *MENU.*`;
                if(isOption6) msgAtendente = `👨🏻‍💻 Envie seu *nome e comprovante 🧾de pagamento* para validação.\n\nAssim que confirmarmos, um de nossos atendentes entrará em contato.\n\n↩️ Para voltar ao menu, digite *MENU.*`;
                await client.sendMessage(from, msgAtendente);
            } else {
                await client.sendMessage(from, respostasComuns.invalido);
            }
            saveUserState();
            return;
        }

        if (['barretos', 'jaguariuna', 'reveillon', 'federalFantasy'].includes(estadoAtual.stage)) {
            const tipoEvento = estadoAtual.stage;
            const opcoes = conteudoEventos[tipoEvento];
            
            let infoContent = null;
            let handled = false;
            let menuAtual;

            const separador = '\n\n_____________________________\n\n';

            switch (tipoEvento) {
                case 'barretos': menuAtual = menuBarretos; break;
                case 'jaguariuna': menuAtual = menuJaguariuna; break;
                case 'federalFantasy': menuAtual = menuFederalFantasy; break;
                case 'reveillon': menuAtual = menuReveillon; break;
            }

            const encerrarAtendimento = async () => {
                await client.sendMessage(from, respostasComuns.avisoApagarMenu);
                await delay(2000);
                await client.sendMessage(from, respostasComuns.encerrar);
                await deleteLastMenuMessage();
                delete userState[from];
            };

            const voltarMenuPrincipal = async () => {
                await client.sendMessage(from, respostasComuns.avisoApagarMenu);
                await delay(2000);
                await client.sendMessage(from, respostasComuns.voltar);
                await deleteLastMenuMessage();
                estadoAtual.stage = null;
                resetInactivityState();
                await delay(700);
                await sendAndStoreMenu(menuPrincipal);
            };
            
            const falarComAtendente = async () => {
                await client.sendMessage(from, respostasComuns.avisoApagarMenu);
                await delay(2000);
                await client.sendMessage(from, respostasComuns.atendente);
                await deleteLastMenuMessage();
                estadoAtual.atendimentoHumano = true;
                resetInactivityState();
            };

            const reservarVaga = async () => {
                await client.sendMessage(from, respostasComuns.avisoApagarMenu);
                await delay(2000);
                await client.sendMessage(from, respostasComuns.reservar);
                await deleteLastMenuMessage();
                estadoAtual.atendimentoHumano = true;
                resetInactivityState();
            };
            
            if (estadoAtual.promptedForMenu) {
                resetInactivityState();

                if (isOption1) {
                    await sendAndStoreMenu(menuAtual);
                } else if (isOption2) {
                    await falarComAtendente();
                } else if (isOption0) {
                    await encerrarAtendimento();
                } else {
                    await client.sendMessage(from, respostasComuns.invalido);
                    await delay(1000);
                    await client.sendMessage(from, respostasComuns.promptMenu);
                    estadoAtual.promptedForMenu = true; 
                    estadoAtual.promptTimestamp = Date.now();
                }
                saveUserState();
                return;
            }

            if (tipoEvento === 'barretos' || tipoEvento === 'jaguariuna' || tipoEvento === 'federalFantasy') {
                if (isOption1) { infoContent = `${opcoes.shows}\n\n${opcoes.embarque}${separador}${opcoes.transportes}${separador}${opcoes.openbar}${separador}${opcoes.ingressos}${separador}${opcoes.pagamento}`; }
                else if (isOption2) { infoContent = `${opcoes.shows}\n\n${opcoes.embarque}`; }
                else if (isOption3) { infoContent = `${opcoes.transportes}${separador}${opcoes.openbar}`; }
                else if (isOption4) { infoContent = opcoes.ingressos; }
                else if (isOption5) { infoContent = opcoes.pagamento; }
                else if (isOption6) { handled = true; await reservarVaga(); }
                else if (isOption7) { handled = true; await falarComAtendente(); }
                else if (isOption8) { handled = true; await voltarMenuPrincipal(); }
                else if (isOption9) { handled = true; await encerrarAtendimento(); }
            }
            
            else if (tipoEvento === 'reveillon') {
                if (isOption1) { infoContent = `${opcoes.shows}\n\n${opcoes.embarque}${separador}${opcoes.pacote}\n\n${opcoes.transportes}${separador}${opcoes.openbar}${separador}${opcoes.pagamento}`; }
                else if (isOption2) { infoContent = `${opcoes.shows}\n\n${opcoes.embarque}`; }
                else if (isOption3) { infoContent = `${opcoes.pacote}\n\n${opcoes.transportes}${separador}${opcoes.openbar}`; }
                else if (isOption4) { infoContent = opcoes.pagamento; }
                else if (isOption5) { handled = true; await reservarVaga(); }
                else if (isOption6) { handled = true; await falarComAtendente(); }
                else if (isOption7) { handled = true; await voltarMenuPrincipal(); }
                else if (isOption8) { handled = true; await encerrarAtendimento(); }
            }

            if (infoContent) {
                await delay(HUMAN_LIKE_DELAY_MS);
                await client.sendMessage(from, infoContent);

                await delay(1500); 
                await client.sendMessage(from, respostasComuns.promptMenu);
                await deleteLastMenuMessage();

                estadoAtual.promptedForMenu = true;
                estadoAtual.promptTimestamp = Date.now();
                estadoAtual.reminderSent = false;
                handled = true;
            }

            if (!handled) {
                await client.sendMessage(from, respostasComuns.invalido);
            }
            saveUserState();
            return;
        }
    } catch (err) {
        console.error(`[ERRO GRAVE] Falha no processamento da mensagem de ${msg.from}. Erro:`, err);
    } finally {
        processingUsers.delete(from);
    }
}

client.on('message', processMessage);

// --- MÓDULO DE COMANDOS VIA TERMINAL ---
const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'BOT_CMD> '
});

function startConsoleCommands() {
    rl.prompt();

    rl.on('line', async (line) => {
        const commandLine = line.trim();
        if (commandLine.startsWith('!')) {
            const parts = commandLine.split(' ');
            const command = parts[0];
            const targetClientNumber = parts[1];
            
            if (!targetClientNumber || !targetClientNumber.endsWith('@c.us')) {
                console.log('⚠️ ERRO: Especifique o número do cliente (ex: !comando 5511987654321@c.us).');
                rl.prompt();
                return;
            }

            if (!userState[targetClientNumber]) {
                console.log(`⚠️ ERRO: Cliente ${targetClientNumber} não possui um estado salvo.`);
                rl.prompt();
                return;
            }

            const clientState = userState[targetClientNumber];
            const clientContact = await client.getContactById(targetClientNumber);
            const clientName = clientContact ? (clientContact.pushname || 'Cliente') : targetClientNumber.split('@')[0];

            console.log(`[COMANDO TERMINAL] Executando: "${command}" para cliente: ${clientName}`);

            switch (command) {
                case '!ativarbot':
                    clientState.atendimentoHumano = false;
                    clientState.stage = null;
                    await client.sendMessage(targetClientNumber, menuPrincipal());
                    console.log(`✅ Bot ativado para ${clientName}.`);
                    break;
                case '!reativar':
                    clientState.atendimentoHumano = false;
                    clientState.stage = null;
                    clientState.initialGreetingSent = false;
                    saveUserState();
                    console.log(`✅ Bot reativado silenciosamente para ${clientName}. O bot responderá na próxima mensagem.`);
                    break;

                case '!desativarbot':
                    clientState.atendimentoHumano = true;
                    clientState.stage = null;
                    await client.sendMessage(targetClientNumber, `👨🏻‍💻 Olá! Um atendente continuará seu atendimento. Por gentileza, aguarde.`);
                    console.log(`✅ Bot desativado para ${clientName}.`);
                    break;
                
                case '!acao':
                    const commandArgs = parts.slice(2).join(' ');
                    const optionNumber = commandArgs.split(' ')[0];
                    if (!optionNumber || isNaN(optionNumber) || parseInt(optionNumber) < 0 || parseInt(optionNumber) > 7) {
                        console.log('⚠️ ERRO: Para !acao, especifique uma opção numérica válida do menu principal (0-7).');
                        break;
                    }

                    clientState.atendimentoHumano = false;
                    let newStage = null;
                    let menuToSend = null;
                    let messageToUser = `👨🏻‍💻 Entendido! Nosso atendimento automático foi retomado.`;

                    switch (optionNumber) {
                        case '0': newStage = null; menuToSend = menuPrincipal(); break;
                        case '1': newStage = 'barretos'; menuToSend = menuBarretos(); break;
                        case '2': newStage = 'jaguariuna'; menuToSend = menuJaguariuna(); break;
                        case '3': newStage = 'federalFantasy'; menuToSend = menuFederalFantasy(); break;
                        case '4': newStage = 'reveillon'; menuToSend = menuReveillon(); break;
                        case '5': clientState.atendimentoHumano = true; messageToUser = `📬 Olá! *Sobre sua reserva*...`; break;
                        case '6': clientState.atendimentoHumano = true; messageToUser = `💳 Olá! *Realizar pagamento*...`; break;
                        case '7': clientState.atendimentoHumano = true; messageToUser = respostasComuns.atendente; break;
                    }
                    clientState.stage = newStage;
                    await client.sendMessage(targetClientNumber, messageToUser);
                    if (menuToSend) {
                        await delay(500);
                        await client.sendMessage(targetClientNumber, menuToSend);
                    }
                    console.log(`✅ Comando !acao ${optionNumber} executado para ${clientName}.`);
                    break;

                default:
                    console.log(`⚠️ Comando desconhecido. Use !ativarbot, !desativarbot, !reativar, !acao [0-7].`);
                    break;
            }
            saveUserState();
        } else {
            console.log('Comando inválido. Use "!"');
        }
        rl.prompt();
    }).on('close', () => {
        console.log('Saindo...');
        process.exit(0);
    });
}