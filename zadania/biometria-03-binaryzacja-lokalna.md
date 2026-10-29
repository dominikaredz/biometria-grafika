# Biometria – Zadanie 3: zaawansowane metody binaryzacji

**Status:** ✅ zrealizowane (5 z 6 metod z listy + własna)

## Treść zadania

- Zaimplementować wybrane 3 algorytmy (75%, 3 × 25%):
  1. [Niblack](https://research.ijcaonline.org/volume98/number12/pxc3897560.pdf) (binaryzacja lokalna na podstawie średniej i odchylenia standardowego)
  2. [Sauvola](https://www.researchgate.net/publication/3710586_Adaptive_Document_Binarization) (binaryzacja na podstawie algorytmu Niblacka), [artykuł prościej wyjaśniający](https://research.ijcaonline.org/volume98/number12/pxc3897560.pdf)
  3. [Phansalkar](https://www.researchgate.net/publication/224226466_Adaptive_local_thresholding_for_detection_of_nuclei_in_diversity_stained_cytology_images) (binaryzacja na podstawie algorytmu Niblacka)
  4. [Kapur](https://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.711.5008) (binaryzacja na podstawie entropii)
  5. [LuWu](https://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.711.5008) (binaryzacja na podstawie entropii)
  6. [Bernsen](https://research.ijcaonline.org/volume98/number12/pxc3897560.pdf) (binaryzacja globalna na podstawie kontrastu)
- Stworzyć własny, dowolny algorytm binaryzacji (25%).
- Za większą liczbę implementacji można uzyskać punkty dodatkowe – każdy dodatkowy
  algorytm to 5 punktów więcej.

## Stan przed realizacją

| Wymaganie | Stan |
|-----------|------|
| Binaryzacja z ręcznym progiem, Otsu | ✅ było (Biometria 1–2) – nie ma ich na liście tego zadania |
| Niblack, Sauvola, Phansalkar, Kapur, LuWu, Bernsen | ❌ brak |
| Własny algorytm | ❌ brak |

## Checklista wymagań

- [x] Niblack
- [x] Sauvola
- [x] Phansalkar
- [x] Kapur
- [ ] LuWu – **nie zrobione**, patrz „Pytania otwarte”
- [x] Bernsen
- [x] Własny algorytm: „Otsu z kompensacją oświetlenia”

Wymagane 3 metody + 2 dodatkowe (+10 pkt) + własna.

## Wzory

Oznaczenia: v – wartość piksela (szarość = średnia kanałów), m i s – średnia
i odchylenie standardowe w oknie w × w wokół piksela. Wynik: biały, gdy v ≥ T.

| Metoda | Próg T | Parametry domyślne |
|--------|--------|--------------------|
| Niblack | T = m + k·s | w = 15, k = −0,2 |
| Sauvola | T = m·(1 + k·(s/R − 1)) | w = 15, k = 0,5, R = 128 |
| Phansalkar | T = m·(1 + p·e^(−q·m) + k·(s/R − 1)), na wartościach 0–1 | w = 15, k = 0,25, p = 2, q = 10, R = 0,5 |
| Bernsen | T = (min + max)/2, gdy max − min ≥ L; jednolite okno: cały piksel wg (min + max)/2 ≥ próg globalny | w = 31, L = 15, próg globalny = 128 |
| Kapur | t maksymalizujące H_tła(t) + H_obiektu(t), H = −Σ (p_i/P)·ln(p_i/P) | – |
| Własny | v' = v − β·(B − G), T = Otsu(v'), B – średnia w dużym oknie, G – średnia obrazu | okno 61, β = 0,8 |

## Własny algorytm – „Otsu z kompensacją oświetlenia”

Metody lokalne (Niblack, Sauvola) dobrze znoszą nierówne oświetlenie, ale „wydrążają”
duże obiekty: wnętrze obiektu większego niż okno wygląda dla nich jak jednolite tło.
Otsu poprawnie traktuje duże obiekty, ale zawodzi przy gradiencie oświetlenia.

Mój algorytm najpierw usuwa z obrazu wolnozmienne oświetlenie, a dopiero potem
stosuje jeden próg Otsu:

1. B(x, y) – średnia w dużym oknie (61×61) to szacunek oświetlenia,
2. G – średnia jasność całego obrazu,
3. obraz wyrównany: v' = v − β·(B − G), czyli miejsca jaśniejsze od przeciętnej
   przyciemniamy, a ciemniejsze rozjaśniamy,
4. T = Otsu(histogram v'), a piksel jest biały, gdy v' ≥ T.

β < 1 zostawia część lokalnego kontrastu, dzięki czemu duży ciemny obiekt
(który też obniża B) nie zostaje „wyrównany” do koloru tła.

Porównanie na obrazach testowych (% poprawnie sklasyfikowanych pikseli):

| Scena | Niblack | Sauvola | Bernsen | Własny |
|-------|---------|---------|---------|--------|
| ciemne znaki na tle z silnym gradientem | 87,4% | 100% | 99,4% | 100% |
| duży ciemny obiekt (średnica 70 px) na jasnym tle | 62,4% | 85,9% | 100% | 100% |

## Pytania otwarte

- **LuWu:** w znanej literaturze o progowaniu entropijnym (m.in. przegląd
  Sezgin & Sankur, który najpewniej kryje się pod linkiem citeseerx) nie udało
  mi się jednoznacznie ustalić metody o tej nazwie. Nie chcę implementować
  „na zgadywanie”. Jeśli w materiałach z zajęć jest wzór, wystarczy go podać –
  metoda zmieści się w istniejącym module (`Thresholding.METHODS`) jako kolejna
  pozycja (+5 pkt).
- **Bernsen** jest w treści zadania opisany jako „globalny”. W oryginale
  (i w podlinkowanym artykule) to metoda lokalna: próg z kontrastu w oknie.
  Zrealizowano wersję lokalną, z progiem globalnym tylko dla okien
  o niskim kontraście.

## Realizacja

| Element | Gdzie |
|---------|-------|
| Metody i rejestr parametrów | `js/thresholding.js` – `binarize`, `METHODS`, `kapurThreshold`, `localStats` |
| Pola parametrów generowane z opisu | `js/ui.js` – `createParamFields` |
| Zakładka „Metody” | `index.html`, obsługa w `js/main.js` |

Szybkość: średnia i odchylenie w oknie liczone obrazem całkowym, a min/max
(Bernsen) monotoniczną kolejką. Koszt nie zależy od rozmiaru okna.
Dla obrazu 512×512 każda metoda zajmuje 8–56 ms.
