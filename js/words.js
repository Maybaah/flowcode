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

  // code tokens: single "words" with the symbols real code makes you type
  const CODE = [
    "const","let","var","function","return","if(x)","else","for(;;)","while","do",
    "=>","async","await","import","export","class","null","true","false","void",
    "x++","i--","a+=b","n-=1","x*=2","arr[i]","obj.key","foo()","bar(x)","()=>{}",
    "[1,2,3]","{a:1}","a&&b","x||y","a===b","x!==y","a<=b","c>=d","!done","x??y",
    "?.","...args","typeof","new","this","super()","try{","catch(e)","throw","finally",
    "<div>","</div>","<br/>","#root",".class","::after","@media","!important","href","src=\"\"",
    "npm","git","sudo","echo","grep","curl","chmod","mkdir","cd..","ls-la",
    "def","lambda","print()","range()","len(x)","try:","except:","elif","yield","self",
    "fn","mut","impl","pub","use","&str","i32","Vec<T>","Some(x)","None",
    "Ok(())","match","enum","struct","trait","int","char*","size_t","nullptr","auto",
    "SELECT","FROM","WHERE","JOIN","LIMIT","INSERT","UPDATE","DELETE","INDEX","NULL",
  ];

  const LISTS = { ru: RU, en: EN, code: CODE };
  const PUNCT = [",", ",", ".", ".", "!", "?", ";", ":"];

  function pick(list, rnd) {
    return list[(rnd() * list.length) | 0];
  }

  function next(cfg, rnd = Math.random) {
    // pasted custom text overrides everything
    if (cfg.customList && cfg.customList.length) return pick(cfg.customList, rnd);

    const list = LISTS[cfg.lang] || EN;
    if (cfg.lang === "code") return pick(CODE, rnd);

    if (cfg.nums && rnd() < 0.15) {
      return String(10 + Math.floor(rnd() * 9990));
    }
    let w = pick(list, rnd);
    // adaptive: sometimes steer toward the player's weakest keys
    if (cfg.weakChars && cfg.weakChars.length && rnd() < 0.3) {
      for (let i = 0; i < 12; i++) {
        const t = pick(list, rnd);
        if (cfg.weakChars.some(ch => t.includes(ch))) { w = t; break; }
      }
    }
    if (cfg.punct) {
      if (rnd() < 0.15) w = w[0].toUpperCase() + w.slice(1);
      const r = rnd();
      if (r < 0.1) w = "(" + w + ")";
      else if (r < 0.4) w += PUNCT[(rnd() * PUNCT.length) | 0];
    }
    return w;
  }

  // short clean word — used for power-up cubes
  function shortWord(cfg, rnd = Math.random) {
    const list = (cfg.customList && cfg.customList.length) ? cfg.customList : (LISTS[cfg.lang] || EN);
    for (let i = 0; i < 40; i++) {
      const w = pick(list, rnd);
      if (w.length >= 3 && w.length <= 5) return w;
    }
    return pick(list, rnd);
  }

  return { next, shortWord, LISTS };
})();
