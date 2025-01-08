import { Telegraf } from 'telegraf';
import { questions } from '../data/questions'; // Импорт вопросов

const bot = new Telegraf(process.env.BOT_TOKEN);

const userSessions = {};

bot.start((ctx) => {
  const userId = ctx.from.id;
  userSessions[userId] = { currentQuestionIndex: 0 };
  ctx.reply('Привет! Начинаем опрос!');

  // Задержка 2 секунды перед отправкой первого вопроса
  setTimeout(() => {
    askQuestion(ctx);
  }, 2000);
});

function askQuestion(ctx) {
  const userId = ctx.from.id;
  const session = userSessions[userId];
  const questionData = questions[session.currentQuestionIndex];

  // Отправляем вопрос как опрос (poll)
  bot.telegram.sendPoll(
    ctx.chat.id,
    questionData.question,
    questionData.options,
    { is_anonymous: false }
  );
}

bot.on('poll_answer', (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions[userId];
  const questionData = questions[session.currentQuestionIndex];
  const userAnswer = ctx.pollAnswer.option_ids[0]; // Получаем ответ пользователя

  if (questionData.options[userAnswer] === questionData.correctAnswer) {
    ctx.reply('Правильный ответ! Переходим к следующему вопросу.');
    session.currentQuestionIndex += 1;

    if (session.currentQuestionIndex < questions.length) {
      // Задержка 2 секунды перед отправкой следующего вопроса
      setTimeout(() => {
        askQuestion(ctx);
      }, 2000);
    } else {
      ctx.reply('Поздравляю, ты прошел опрос!');
      delete userSessions[userId];
    }
  } else {
    ctx.reply('Неверный ответ. Попробуй снова.');
    // Задержка 2 секунды перед повторной отправкой того же вопроса
    setTimeout(() => {
      askQuestion(ctx);
    }, 2000);
  }
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body, res);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error handling update:', error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
