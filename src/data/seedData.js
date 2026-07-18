// Seed / sample data for the dashboard, ported from the design reference's
// mkDay2a(). Every external-integration field here (HubSpot, Lembretes,
// TickTick, Notion, Downloads/Backlog/Fotos counts) is static sample data —
// swap for real API calls when wiring up those integrations.

export function createSeedState() {
  const now = Date.now();
  return {
    page: 'hoje',
    newNoteText: '',
    lastResetDate: new Date().toDateString(),

    notes: [
      { id: 1, text: 'Ligar pro dentista', bg: '#fdf3d0', tc: '#8a7a2f' },
      { id: 2, text: 'Separar roupas de treino', bg: '#fdf3d0', tc: '#8a7a2f' },
      { id: 3, text: 'Comprar frutas', bg: '#fdf3d0', tc: '#8a7a2f' },
      { id: 4, text: 'Enviar orçamento', bg: '#fdf3d0', tc: '#8a7a2f' },
    ],

    manha: [
      { id: 1, label: 'Atividades da Agenda (fantastical) com horário', done: false },
      { id: 2, label: 'Notion: Aguardando resposta', done: false, link: 'https://notion.so' },
      { id: 3, label: 'Notion: Lista Terceiros', done: false, link: 'https://notion.so' },
      { id: 4, label: 'Notion: Lista Edite', done: false, link: 'https://notion.so' },
      { id: 5, label: 'Notion: Atividades Atrasadas', done: false, link: 'https://notion.so' },
      { id: 6, label: 'Notion: Atividades Hoje', done: false, link: 'https://notion.so' },
      { id: 7, label: 'Indicadores Diários', done: false },
      { id: 8, label: 'Executar atividades da Agenda (sem horário)', done: false },
      { id: 9, label: 'eMails: novos & sem etiqueta', done: false, link: 'https://mail.google.com/mail' },
      { id: 10, label: 'eMails: TODAY', done: false, link: 'https://mail.google.com/mail' },
      { id: 11, label: 'WhatsApp: Não lidos', done: false, link: 'https://web.whatsapp.com' },
    ],

    noite: [
      { id: 1, label: 'Notion: Hoje', done: false, link: 'https://notion.so' },
      { id: 2, label: 'Lembretes: em Aberto Hoje', done: false, link: 'https://www.icloud.com/reminders' },
      { id: 3, label: 'Lembretes: Inbox', done: false, link: 'https://www.icloud.com/reminders' },
      { id: 4, label: 'Notion: Caixa de Entrada', done: false, link: 'https://notion.so' },
      { id: 5, label: 'Bloquinho Rascunho', done: false },
      { id: 6, label: 'Hubspot: Sem Tarefas e Atrasadas', done: false, link: 'https://app.hubspot.com' },
      { id: 7, label: 'WhatsApp: Não lidos', done: false, link: 'https://web.whatsapp.com' },
      { id: 8, label: 'WhatsApp: Abas HOT, Leitura Diária', done: false, link: 'https://web.whatsapp.com' },
      { id: 9, label: 'WhatsApp: Favoritos', done: false, link: 'https://web.whatsapp.com' },
      { id: 10, label: 'eMails', done: false, link: 'https://mail.google.com/mail' },
      { id: 11, label: 'Diretório_Downloads', done: false },
      { id: 12, label: 'Craft Inbox', done: false },
    ],

    agendaDay: 'hoje',

    ticktickHoje: [
      { id: 1, label: 'Finalizar apresentação' },
      { id: 2, label: 'Revisar PR do time' },
      { id: 3, label: 'Responder e-mails pendentes' },
    ],

    downloadsCount: 61,
    backlogCount: 128,
    manhaOpen: false,
    noiteOpen: false,
    downloadsOpen: false,
    backlogOpen: false,
    fotosOpen: false,

    downloadsUpdated: now,
    backlogUpdated: now,
    fotosUpdated: now,
    ticktickUpdated: now,

    manhaEdit: false,
    noiteEdit: false,
    newManhaText: '',
    newNoiteText: '',
    newManhaLink: '',
    newNoiteLink: '',
    dragId: null,
    dragList: null,

    fotosCount: 9795,
    fotosSub: [
      { name: 'Viagens', count: 2140 },
      { name: 'Família', count: 3820 },
      { name: 'Trabalho', count: 1560 },
      { name: 'Screenshots', count: 2275 },
    ],
    downloadsSub: [
      { name: 'Comprovantes', count: 12 },
      { name: 'Contratos', count: 20 },
      { name: 'Fotos', count: 29 },
    ],
    backlogSub: [
      { name: 'Propostas', count: 40 },
      { name: 'Design', count: 55 },
      { name: 'Documentos', count: 33 },
    ],

    habits: [
      { id: 1, label: 'Beber água ao acordar', streak: 6, done: true },
      { id: 2, label: 'Meditar 10 min', streak: 5, done: true },
      { id: 3, label: 'Ler 20 páginas', streak: 3, done: false },
      { id: 4, label: 'Alongar', streak: 2, done: false },
      { id: 5, label: 'Dormir até as 23h', streak: 4, done: false },
    ],

    water: 5,
    waterTarget: 8,
    sleepHours: 7.3,
    weight: 78.4,
    weightTarget: 75,
    newWeightText: '',
    weightLog: [
      { date: '07/07', value: 78.6 },
      { date: '05/07', value: 78.9 },
      { date: '03/07', value: 79.1 },
    ],
    sleepWeek: [
      { label: 'S', hours: 7.5 },
      { label: 'M', hours: 6.8 },
      { label: 'T', hours: 7.9 },
      { label: 'Q', hours: 7.3 },
      { label: 'Q', hours: 6.5 },
      { label: 'S', hours: 8.1 },
      { label: 'D', hours: 8.4 },
    ],
    goalsList: [
      { label: 'Treinar 4x na semana', current: 3, target: 4 },
      { label: 'Ler 2 livros', current: 1, target: 2 },
      { label: 'Meditar todo dia', current: 4, target: 7 },
      { label: 'Beber 2L água/dia', current: 5, target: 7 },
    ],
  };
}

// Note color pair (bg / text) — pastel yellow, used for every note.
export const NOTE_COLORS = [{ bg: '#fdf3d0', tc: '#8a7a2f' }];
