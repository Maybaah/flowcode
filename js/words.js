"use strict";
/* flowcode — word lists and flow generator */
const Words = (() => {
  const RU = [
    "время","человек","жизнь","день","рука","работа","слово","место","лицо","друг",
    "глаз","вопрос","дом","сторона","страна","мир","случай","голова","сила","конец",
    "вид","система","часть","город","деньги","земля","машина","вода","отец","проблема",
    "час","право","нога","решение","дверь","образ","история","власть","закон","война",
    "голос","книга","ночь","стол","имя","область","статья","число","компания","народ",
    "жена","группа","развитие","процесс","суд","условие","средство","начало","свет","пора",
    "путь","душа","уровень","форма","связь","минута","улица","вечер","качество","мысль",
    "дорога","мать","действие","месяц","язык","любовь","взгляд","мама","век","школа",
    "цель","общество","комната","порядок","момент","театр","письмо","утро","помощь","роль",
    "рынок","программа","задача","окно","счет","брат","честь","хлеб","чай","лес",
    "море","снег","ветер","огонь","камень","трава","птица","рыба","зверь","кот",
    "собака","конь","стена","пол","потолок","крыша","сад","поле","река","гора",
    "небо","звезда","солнце","луна","дождь","туман","холод","тепло","лето","зима",
    "весна","осень","год","неделя","среда","игра","песня","музыка","танец","цвет",
    "звук","запах","вкус","еда","суп","каша","мясо","молоко","сахар","соль",
    "масло","яблоко","стакан","чашка","ложка","вилка","нож","тарелка","одежда","обувь",
    "шапка","куртка","ткань","нитка","игла","бумага","ручка","тетрадь","урок","класс",
    "учитель","ученик","студент","наука","опыт","знание","ум","память","сон","отдых",
    "труд","дело","успех","ошибка","победа","битва","армия","оружие","защита","граница",
    "король","замок","башня","мост","корабль","парус","волна","берег","остров","маяк",
    "поезд","вагон","билет","вокзал","самолет","крыло","полет","космос","ракета","планета",
    "экран","кнопка","файл","сеть","код","игрок","поток","куб","цифра","буква",
    "быть","мочь","сказать","знать","стать","видеть","хотеть","думать","идти","дать",
    "жить","делать","взять","понять","начать","найти","писать","читать","бежать","лететь",
    "новый","белый","черный","старый","добрый","живой","тихий","яркий","легкий","точный",
    "быстро","медленно","всегда","никогда","вместе","рядом","далеко","близко","вчера","завтра",
  ];

  const EN = [
    "time","year","people","way","day","man","thing","woman","life","child",
    "world","school","state","family","student","group","country","problem","hand","part",
    "place","case","week","company","system","program","question","work","number","night",
    "point","home","water","room","mother","area","money","story","fact","month",
    "book","eye","job","word","business","issue","side","kind","head","house",
    "service","friend","father","power","hour","game","line","end","member","law",
    "car","city","name","team","minute","idea","kid","body","face","level",
    "office","door","health","person","art","war","history","party","result","change",
    "morning","reason","research","girl","guy","moment","air","teacher","force","education",
    "foot","boy","age","policy","music","market","sense","nation","plan","college",
    "interest","death","course","someone","effect","use","class","control","care","field",
    "development","role","effort","rate","heart","drug","show","leader","light","voice",
    "wife","police","mind","price","report","decision","son","view","relationship","town",
    "road","arm","difference","value","building","action","model","season","society","tax",
    "director","position","player","record","paper","space","ground","form","event","official",
    "matter","center","couple","site","project","activity","star","table","court","american",
    "make","know","will","think","take","see","come","could","want","look",
    "use","find","give","tell","ask","seem","feel","try","leave","call",
    "keep","let","begin","help","talk","turn","start","show","hear","play",
    "run","move","like","live","believe","hold","bring","happen","write","provide",
    "sit","stand","lose","pay","meet","include","continue","set","learn","lead",
    "understand","watch","follow","stop","create","speak","read","allow","add","spend",
    "grow","open","walk","win","offer","remember","love","consider","appear","buy",
    "wait","serve","send","expect","build","stay","fall","cut","reach","remain",
    "small","large","great","young","early","strong","whole","free","true","easy",
    "clear","recent","late","single","hard","real","best","only","sure","full",
  ];

  const LISTS = { ru: RU, en: EN };
  const PUNCT = [",", ",", ".", ".", "!", "?", ";", ":"];

  function base(cfg) {
    const list = LISTS[cfg.lang] || RU;
    return list[(Math.random() * list.length) | 0];
  }

  function next(cfg) {
    if (cfg.nums && Math.random() < 0.15) {
      return String(10 + Math.floor(Math.random() * 9990));
    }
    let w = base(cfg);
    if (cfg.punct) {
      if (Math.random() < 0.15) w = w[0].toUpperCase() + w.slice(1);
      const r = Math.random();
      if (r < 0.1) w = "(" + w + ")";
      else if (r < 0.4) w += PUNCT[(Math.random() * PUNCT.length) | 0];
    }
    return w;
  }

  // short clean word — used for power-up cubes
  function shortWord(cfg) {
    const list = LISTS[cfg.lang] || RU;
    for (let i = 0; i < 40; i++) {
      const w = list[(Math.random() * list.length) | 0];
      if (w.length >= 3 && w.length <= 5) return w;
    }
    return base(cfg);
  }

  return { next, shortWord, LISTS };
})();
