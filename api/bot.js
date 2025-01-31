import { Telegraf, Markup } from 'telegraf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { questions } from '../data/questions.js'; // Импортируем вопросы
dotenv.config();

// Получение пути к текущему файлу и директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Замените на ваш Telegram ID
const ADMIN_TELEGRAM_ID = '6455431647';

const userSessions = {};
console.log('Проверка...');

bot.command('start', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    userSessions[userId] = { currentQuestionIndex: 0, chatId: chatId, practiceButtonClicked: false, reminderSent: false };
    console.log('Команда /start получена');
    
    // Определяем путь к изображению относительно текущей директории
    const photoPath = path.resolve(__dirname, '../media/teo.png');

    // Проверяем, существует ли файл по указанному пути
    if (!fs.existsSync(photoPath)) {
      throw new Error(`File not found: ${photoPath}`);
    }

    // Отправка приветственного сообщения с фото и кнопками "СМОТРЕТЬ УРОК" и "ПЕРЕЙТИ К ПРАКТИКЕ"
    await ctx.telegram.sendPhoto(chatId, { source: fs.createReadStream(photoPath) }, {
      caption: '<b>Привет! Я Тео, и у меня есть для тебя классный разбор! 🔥</b>\n\nСегодня мы освоим несколько крутых конструкций – смотри урок и давай тренироваться!',
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('👉 СМОТРЕТЬ УРОК 🎥', 'https://www.youtube.com/watch?v=GzvRorsZzcU&ab_channel=HannaTsyhankova')],
        [Markup.button.callback('👉 ПЕРЕЙТИ К ПРАКТИКЕ ✍️', 'start_quiz')]
      ])
    });

    // Установить таймер на 5 минут для отправки напоминания
    setTimeout(async () => {
      if (!userSessions[userId].practiceButtonClicked && !userSessions[userId].reminderSent) {
        await ctx.telegram.sendMessage(chatId, '<b>Ну как, запомнил конструкции?</b>\n\n⬆️Скорее переходи к тесту и применяй свои знания на практике ⬆️', {
          parse_mode: 'HTML'
        });
        userSessions[userId].reminderSent = true; // Отметить, что напоминание было отправлено
      }
    }, 300000); // 300000 миллисекунд = 5 минут

  } catch (error) {
    console.error('Ошибка при обработке команды /start:', error);
  }
});

// Функция для отправки вопроса
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

  // Убедитесь, что options — это массив строк
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

// Функция для отправки видеокружочка
async function sendVideoNoteExplanation(chatId, videoFileName) {
  const videoPath = path.resolve(__dirname, `../media/${videoFileName}`);
  console.log(`Trying to send video note: ${videoPath}`);

  // Проверяем, существует ли файл по указанному пути
  if (!fs.existsSync(videoPath)) {
    console.error(`Video file not found: ${videoPath}`);
    return;
  }

  // Отправка видеокружочка
  try {
    await bot.telegram.sendVideoNote(chatId, { source: fs.createReadStream(videoPath) });
    console.log(`Video note sent: ${videoPath}`);
  } catch (error) {
    console.error(`Failed to send video note: ${error.message}`);
  }
}

// Обработчик нажатия на кнопку
bot.action('start_quiz', (ctx) => {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  // Отметить, что пользователь нажал кнопку "ПЕРЕЙТИ К ПРАКТИКЕ"
  if (userSessions[userId]) {
    userSessions[userId].practiceButtonClicked = true;
  }

  askQuestion(chatId, userId);
});

// Сбор данных анкеты
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
      await bot.telegram.sendMessage(session.chatId, 'Спасибо за предоставленную информацию!');
      session.step = null;
      
      // Отправка данных в Telegram на ваш аккаунт
      const userData = session.userData;
      const message = `
        Новая анкета:
        Имя: ${userData.name}
        Контакты: ${userData.contact}
        Уровень английского: ${userData.level}
        Цель: ${userData.goal}
      `;
      await bot.telegram.sendMessage(ADMIN_TELEGRAM_ID, message);
      
      // Отправка данных в Google Sheets
      await sendToGoogleSheets(userData);
      
      break;
  }
}

// Функция для отправки данных в Google Sheets
async function sendToGoogleSheets(userData) {
  const scriptUrl = 'https://script.google.com/macros/s/AKfycbzaqXytmj8eG2UgSu_F3XAHZPQXBQWsZDUWebtXIMDhLUZv8lkI5gDbFFSlk_u2Se8I/exec'; // Замените на URL вашего веб-приложения Google Apps Script
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

// Обработчик ответа на опрос
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

  // Отправка видеокружочка после ответа
  await sendVideoNoteExplanation(session.chatId, `explanation_${questionIndex + 1}.mp4`);

  // Переход к следующему вопросу через 5 секунд после отправки видеокружочка
  setTimeout(() => {
    session.currentQuestionIndex += 1;
    if (session.currentQuestionIndex < questions.length) {
      askQuestion(session.chatId, userId);
    } else {
      setTimeout(async () => {
        await bot.telegram.sendMessage(session.chatId, '<b>Тест пройден, поздравляем!</b>\n\nТы на правильном пути, давай продолжим 👉🏼 \n\nРасскажи немного о себе, и я подскажу, как тебе выйти на новый уровень в английском 🚀', {
          parse_mode: 'HTML'
        });
        session.step = 'name';
        collectUserData(ctx, session.step);
      }, 2000); // 2 секунды задержка перед сообщением о завершении квиза
    }
  }, 5000); // 5 секунд задержка перед отправкой следующего вопроса
});

// Обработчик текстовых сообщений для сбора данных анкеты
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions[userId];

  if (session && session.step) {
    await collectUserData(ctx, session.step);
  }
});

// Запуск бота
bot.launch().then(() => {
  console.log('Бот запущен и готов к работе!');
}).catch((error) => {
  console.error('Ошибка при запуске бота:', error);
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