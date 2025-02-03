import { Telegraf, Markup } from 'telegraf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { questions } from '../data/questions.js';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "7945048692:AAHad-j-a179c71GTrIZ8jkGyqbmj4Prz_8");

const ADMIN_TELEGRAM_ID = '1368374828';

const userSessions = {};
console.log('Проверка...');

bot.command('start', async (ctx) => {
  try {
    console.log('Команда /start получена от пользователя', ctx.from.id);
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    userSessions[userId] = { currentQuestionIndex: 0, chatId: chatId, practiceButtonClicked: false, reminderSent: false };

    const photoPath = path.resolve(__dirname, '../media/teo.png');

    if (!fs.existsSync(photoPath)) {
      throw new Error(`File not found: ${photoPath}`);
    }

    await ctx.telegram.sendPhoto(chatId, { source: fs.createReadStream(photoPath) }, {
      caption: '<b>Привет 👋🏻 Сегодня мы разберем пару крутых конструкций. </b>\n\nСмотри урок и не забудь пройти тест😉',
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('👉 СМОТРЕТЬ УРОК 🎥', 'https://www.youtube.com/watch?v=GzvRorsZzcU&ab_channel=HannaTsyhankova')]
      ])
    });

    // Отправка второго сообщения сразу после первого
    await ctx.telegram.sendMessage(chatId, 'Готов? Возвращайся после урока — будем практиковаться вместе 🚀', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('👉 ПРОЙТИ ТЕСТ ✍️', 'start_quiz')],
        [Markup.button.callback('👉 АНКЕТА ПРЕДЗАПИСИ 📚', 'start_registration')]
      ])
    });
  } catch (error) {
    console.error('Ошибка при обработке команды /start:', error);
  }
});

bot.action('start_quiz', (ctx) => {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (userSessions[userId]) {
    userSessions[userId].practiceButtonClicked = true;
  }

  askQuestion(chatId, userId);
});

bot.action('start_registration', (ctx) => {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (userSessions[userId]) {
    userSessions[userId].step = 'name';
  }

  collectUserData(ctx, 'name');
});

function askQuestion(chatId, userId) {
  const session = userSessions[userId];

  if (!session) {
    bot.telegram.sendMessage(chatId, 'Session not found. Please start the quiz again with /start.');
    return;
  }

  const questionIndex = session.currentQuestionIndex;
  const questionData = questions[questionIndex];

  if (!questionData) {
    bot.telegram.sendMessage(chatId, 'No more questions available.');
    return;
  }

  console.log(`Sending question ${questionIndex + 1}: ${questionData.question}`);

  if (!Array.isArray(questionData.options) || questionData.options.length === 0) {
    console.error('Invalid options for question:', questionData);
    bot.telegram.sendMessage(chatId, 'Failed to send the question. Please check the configuration.');
    return;
  }

  bot.telegram.sendPoll(
    chatId,
    questionData.question,
    questionData.options,
    { is_anonymous: false }
  ).catch((error) => {
    console.error('Error sending poll:', error);
    bot.telegram.sendMessage(chatId, 'Failed to send the question. Please try again later.');
  });
}

async function sendVideoNoteExplanation(chatId, videoFileName) {
  const videoPath = path.resolve(__dirname, `../media/${videoFileName}`);
  console.log(`Trying to send video note: ${videoPath}`);

  if (!fs.existsSync(videoPath)) {
    console.error(`Video file not found: ${videoPath}`);
    return;
  }

  try {
    await bot.telegram.sendVideoNote(chatId, { source: fs.createReadStream(videoPath) });
    console.log(`Video note sent: ${videoPath}`);
  } catch (error) {
    console.error(`Failed to send video note: ${error.message}`);
  }
}

async function collectUserData(ctx, step) {
  const userId = ctx.from.id;
  const session = userSessions[userId];

  if (!session) {
    console.error('Session not found for user:', userId);
    return;
  }

  switch (step) {
    case 'name':
      session.step = 'contact';
      await bot.telegram.sendMessage(session.chatId, 'Ваше имя:');
      break;
    case 'contact':
      session.userData = { name: ctx.message.text };
      session.step = 'level';
      await bot.telegram.sendMessage(session.chatId, 'Ваши контакты для связи (Telegram/WhatsApp/etc):');
      break;
    case 'level':
      session.userData.contact = ctx.message.text;
      session.step = 'goal';
      await bot.telegram.sendMessage(session.chatId, 'Ваш текущий уровень английского:');
      break;
    case 'goal':
      session.userData.level = ctx.message.text;
      session.step = 'done';
      await bot.telegram.sendMessage(session.chatId, 'Цель изучения/улучшения английского:');
      break;
    case 'done':
      session.userData.goal = ctx.message.text;
      await bot.telegram.sendMessage(session.chatId, 'Готово! Я свяжусь с вами в ближайшее время 🚀');
      session.step = null;

      const userData = session.userData;
      const message = `
        Новая анкета:
        Имя: ${userData.name}
        Контакты: ${userData.contact}
        Уровень английского: ${userData.level}
        Цель: ${userData.goal}
      `;
      await bot.telegram.sendMessage(ADMIN_TELEGRAM_ID, message);

      await sendToGoogleSheets(userData);

      break;
  }
}

async function sendToGoogleSheets(userData) {
  const scriptUrl = 'https://script.google.com/macros/s/AKfycbzaqXytmj8eG2UgSu_F3XAHZPQXBQWsZDUWebtXIMDhLUZv8lkI5gDbFFSlk_u2Se8I/exec';
  const payload = {
    name: userData.name,
    contact: userData.contact,
    level: userData.level,
    goal: userData.goal
  };

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('Data sent to Google Sheets:', result);
  } catch (error) {
    console.error('Error sending data to Google Sheets:', error);
  }
}

bot.on('poll_answer', async (ctx) => {
  const pollAnswer = ctx.update.poll_answer;
  if (!pollAnswer || !pollAnswer.user) {
    console.error('Poll answer or user is undefined');
    return;
  }

  const userId = pollAnswer.user.id;
  const session = userSessions[userId];

  if (!session) {
    console.error('Session not found for user:', userId);
    return;
  }

  const questionIndex = session.currentQuestionIndex;
  const questionData = questions[questionIndex];
  const userAnswer = pollAnswer.option_ids[0];

  if (!questionData) {
    console.error('Question data not found for index:', questionIndex);
    return;
  }

  console.log(`User answered question ${questionIndex + 1}:`, questionData.options[userAnswer]);

  const responseMessage = questionData.options[userAnswer] === questionData.correctAnswer
    ? questionData.correctResponse
    : questionData.incorrectResponse;

  await bot.telegram.sendMessage(session.chatId, responseMessage);

  await sendVideoNoteExplanation(session.chatId, `explanation_${questionIndex + 1}.mp4`);

  session.currentQuestionIndex += 1;
  if (session.currentQuestionIndex < questions.length) {
    askQuestion(session.chatId, userId);
  } else {
    await bot.telegram.sendMessage(session.chatId, '<b>Тест пройден, поздравляем!</b>\n\nТы на правильном пути, давай продолжим 👉🏼 \n\nРасскажи немного о себе, и я подскажу, как тебе выйти на новый уровень в английском 🚀', {
      parse_mode: 'HTML'
    });
    session.step = 'name';
    await collectUserData(ctx, session.step);
  }
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions[userId];

  if (session && session.step) {
    await collectUserData(ctx, session.step);
  }
});

// Экспорт обработчика для Vercel
export default async function handler(req, res) {
  if (req.method === 'POST') {
    console.log('Получен POST-запрос от Telegram');
    try {
      console.log('Тело запроса:', req.body);
      await bot.handleUpdate(req.body);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error handling update:', error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    console.log('Получен неверный метод запроса:', req.method);
    res.status(405).send('Method Not Allowed');
  }
}