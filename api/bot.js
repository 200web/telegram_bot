import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
dotenv.config();

const bot = new Telegraf("7945048692:AAHad-j-a179c71GTrIZ8jkGyqbmj4Prz_8");

const userSessions = {};

bot.start((ctx) => {
  const userId = ctx.from.id;
  userSessions[userId] = { sessionId: userId }; // Простой способ создания сессии
  ctx.reply('Привет! Добро пожаловать в нашего бота.');
});

bot.on('text', (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions[userId];

  if (session) {
    ctx.reply(`Ваш номер сессии: ${session.sessionId}`);
  } else {
    ctx.reply('Сессия не найдена. Пожалуйста, начните с команды /start.');
  }
});

bot.launch();

// Обработка остановки бота
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));