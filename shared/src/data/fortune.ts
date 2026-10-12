// Ayşe Teyze's coffee-cup fortune. Once a day per character: a good fortune makes that
// day's +N upgrades likelier, a bad one changes nothing. "A day" is the calendar day in Turkey.

export const FORTUNE_GOOD_CHANCE = 0.45;
/** Added to every upgrade success chance on a good-fortune day (capped at 100%). */
export const FORTUNE_UPGRADE_BONUS = 0.1;

export interface FortuneState {
  /** Calendar day it was read on (YYYY-MM-DD). */
  day: string;
  good: boolean;
  /** Which line was read (so a re-ask repeats it). */
  line: number;
}

export const GOOD_FORTUNES = [
  "Fincanın dibinde kocaman bir kuş var evladım, kanatları açık! Bugün elin neye değse bereketlenir. Demirciye git, bugün senin günün.",
  "Bak bak, şuraya bir yol açılmış, ucunda da parlak bir taş! Bugün kısmetin açık; ekipmanını yükseltmeye ne dersin?",
  "Fincanın kenarında bir balık görüyorum, balık bolluktur! Bugün şans senden yana, örsün başında korkma.",
  "Aaa, bir yüzük çıkmış! Yüzük tamamlanmaktır; bugün yarım kalan işlerin tamamlanır. Yükseltmelerin tutar, inşallah.",
  "Telvede bir dağ, tepesinde güneş! Zorluklar bugün sana eğilir yavrum. Demirci Hasan'a selamımı söyle.",
];

export const BAD_FORTUNES = [
  "Hmm... fincan biraz bulanık evladım. Bugün kara bir kedi geçmiş yolundan. Pek bir şey göremiyorum, sen yine de dikkatli ol.",
  "Telve dağınık, bir yılan kıvrılmış kenarda. Bugün şans pek yüzüne gülmüyor; ama üzülme, yarın yine gel bakalım.",
  "Fincanın dibinde bir düğüm var yavrum, işler biraz karışık. Bugün sana özel bir uğur göremedim.",
  "Ay, fincan ters kapanmamış ki! Neyse... bugün sıradan bir gün gibi duruyor. Ne iyi ne kötü, şansın bildiğin gibi.",
];

/** Today's date in Turkey as YYYY-MM-DD. */
export function fortuneDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function fortuneText(state: FortuneState): string {
  const lines = state.good ? GOOD_FORTUNES : BAD_FORTUNES;
  return lines[state.line % lines.length];
}
