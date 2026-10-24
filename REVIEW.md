# Review list

Words, readings or choices that need a human check. Tick each one once checked.

## Stage 1 hiragana

- [ ] **る (ru)**: very few common beginner words *start* with る (the main one is るす "being away
      from home", which is abstract). Used はる haru "spring" instead, which has る at the end.
- [ ] **を (o/wo)**: を only appears as a grammar particle, never inside a normal word. Used the short
      phrase みずをのむ mizu o nomu "to drink water" as the sample.
- [ ] **ん (n)**: no Japanese word starts with ん. Used にほん Nihon "Japan" (also read にっぽん Nippon).
- [ ] **はし (hashi)**: means "chopsticks" (箸) here. The same kana also means "bridge" (橋); only the pitch
      differs. Check that the generated audio uses the "chopsticks" pitch (HA-shi, high then low).
- [ ] **お (o)**: おちゃ ocha. The お here is the polite prefix お (お茶). Still a natural, very common word.

## Stage 2 hiragana (voiced)

- [ ] **ぐ (gu)**: ぐあい guai "condition (how you feel)", as in ぐあいがわるい "I feel unwell".
      Correct, but a bit abstract for a beginner.
- [ ] **ぱ / ぴ (pa / pi)**: almost no everyday native words start with ぱ or ぴ (mostly sound words).
      Used かんぱい kanpai "cheers!" and えんぴつ enpitsu "pencil", which contain them.
- [ ] **ぺ (pe)**: ぺこぺこ pekopeko "starving" is a sound-symbolic word (おなかがぺこぺこ "I'm starving").
- [ ] **ぽ (po)**: さんぽ sanpo "a walk" contains ぽ rather than starting with it.

## Stage 3 hiragana (combinations)

Many combinations rarely start a common word, so some samples contain the sound instead.

- [ ] **にゃ**: こんにゃく konnyaku, a jelly-like food (common in oden). Mark may not know it.
- [ ] **にょ**: にょろにょろ nyoronyoro "wriggling (like a snake)", a sound-symbolic word. No common
      everyday word starts with にょ.
- [ ] **ひゅ**: ひゅうひゅう hyūhyū "whoosh (wind)", a sound-symbolic word.
- [ ] **ひょ**: ひょうしき hyōshiki "sign (road sign)". Correct, but not an early beginner word.
- [ ] **みゃ / りゃ**: みゃく myaku "pulse" and りゃく ryaku "abbreviation". Correct, but not common
      beginner words; few words start with these.
- [ ] **みゅ, びゅ, ぴゅ**: no native hiragana word uses these. The examples are katakana loanwords
      ミュージック "music", ビュッフェ "buffet", コンピューター "computer" (the matching katakana is highlighted).
- [ ] **ぴょ**: ぴょんぴょん pyonpyon "hopping", a sound-symbolic word.

## Katakana

- [ ] **ヤ (ya)**: タイヤ taiya "tire" contains ヤ; few common loanwords start with ヤ.
- [ ] **ユ (yu)**: ユーロ yūro "euro (currency)".
- [ ] **ム (mu)**: ムード mūdo "mood, atmosphere". Recognizable, but Japanese ムード is used a bit
      differently from English "mood".
- [ ] **ニ (ni)**: ニックネーム nikkunēmu "nickname" (long, but starts with ニ).
- [ ] **ザ (za)**: デザート dezāto "dessert" contains ザ; few common loanwords start with ザ.
- [ ] **キュ**: バーベキュー bābekyū "barbecue" contains キュ.
- [ ] **キョ**: トーキョー Tōkyō "Tokyo" in katakana. Normally written in kanji 東京; katakana is used in ads/signs.
- [ ] **ニャ**: ニャー nyā "meow".
- [ ] **ヒュ**: ヒューズ hyūzu "fuse (electrical)". Correct, but not a word Mark will use often.
- [ ] **ヒョ**: ヒョウ hyō "leopard". Not a loanword, but animal names are often written in katakana.
- [ ] **ギョ**: ギョーザ gyōza. Menus use both ギョーザ and ぎょうざ.
- [ ] **Rare katakana that use the hiragana word instead**: ヲ (みずをのむ), ヂ (はなぢ), ヅ (つづく),
      ヒャ (ひゃく), ミョ (みょうじ), リャ (りゃく), リョ (りょこう), ギュ (ぎゅうどん), ビャ (さんびゃく),
      ビョ (びょういん), ピャ (はっぴゃく), ピョ (ぴょんぴょん). These katakana almost never appear in
      real loanwords; the card tip says so and the matching hiragana is highlighted.

## Audio

- [ ] **Male voice**: `jm_kumo` is Kokoro's only Japanese male voice and its lowest-rated one
      (grade C−, trained on only a few minutes of speech; the female `jf_alpha` is C+). Listen to a
      few cards in Settings → Male voice and decide whether to keep the option.

- [ ] **Hand-written phonemes**: the voice model's text reader split some combinations into two beats
      (for example みょ read as "mi-yo", さんびゃく as "san-bi-ya-ku"). These are now given the correct
      sounds by hand in `PHONEMES_INSTEAD` in `scripts/generate_audio.py`. Please listen to:
      は, へ, にゅ, ひゃ/ひゅ/ひょ, みゃ/みゅ/みょ, りゃ/りゅ/りょ, ぎょ, びゃ/びゅ/びょ, ぴゃ/ぴょ,
      ミョ, リョ, ギョ, and the words りゃく, さんびゃく, はっぴゃく.
