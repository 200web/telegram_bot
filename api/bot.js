import { Telegraf } from 'telegraf';
import { questions } from '../data/questions'; 

const bot = new Telegraf(process.env.BOT_TOKEN);

const userSessions = {};

bot.start((ctx) => {
  const userId = ctx.from.id;
  userSessions[userId] = { currentQuestionIndex: 0 };
  ctx.reply('Welcome! Enter /start to begin the quiz.');

  setTimeout(() => {
    askQuestion(ctx);
  }, 1000); // Увеличена задержка
});

function askQuestion(ctx) {
  const userId = ctx.from.id;
  const session = userSessions[userId];

  if (!session || session.currentQuestionIndex >= questions.length) {
    ctx.reply('Опрос завершен или произошла ошибка.');
    return;
  }

  const questionData = questions[session.currentQuestionIndex];

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

  if (!session || session.currentQuestionIndex >= questions.length) {
    ctx.reply('Опрос завершен или произошла ошибка.');
    return;
  }

  const questionData = questions[session.currentQuestionIndex];
  const userAnswer = ctx.pollAnswer.option_ids[0];

  if (userAnswer >= questionData.options.length) {
    ctx.reply('Произошла ошибка. Попробуйте снова.');
    return;
  }

  if (questionData.options[userAnswer] === questionData.correctAnswer) {
    ctx.reply('Правильный ответ! Переходим к следующему вопросу.');
    session.currentQuestionIndex += 1;

    if (session.currentQuestionIndex < questions.length) {
      setTimeout(() => {
        askQuestion(ctx);
      }, 2000);
    } else {
      ctx.reply('Поздравляю, ты прошел опрос!');
      delete userSessions[userId];
    }
  } else {
    ctx.reply('Неверный ответ. Попробуй снова.');
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
