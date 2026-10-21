# Pliki JavaScript – podsumowanie

Krótki przegląd: co jest w którym pliku i do czego służy.
Szczegółowy opis każdej funkcji (także dla osób, które nie znają JS):
[przewodnik-po-kodzie.md](przewodnik-po-kodzie.md).

## Jak pliki są ze sobą połączone

Każdy plik dopisuje swój moduł do jednego wspólnego obiektu `window.BioEditor`
(np. `BioEditor.Histogram`, `BioEditor.Shapes`). Pliki są wczytywane w `index.html`
po kolei, a na końcu `main.js` bierze z `BioEditor` wszystkie moduły i łączy je
z przyciskami w interfejsie.

```
index.html
  ├─ imageIO.js          ─┐
  ├─ imageProcessing.js   │  algorytmy i dane – nic nie wiedzą o przyciskach
  ├─ histogram.js         │
  ├─ colorSpaces.js       │
  ├─ raster.js            │
  ├─ shapes.js           ─┘
  ├─ ui.js               ─┐
  ├─ colorPicker.js       │  elementy interfejsu (panele, mysz)
  ├─ drawingTool.js       │
  ├─ shapeForm.js        ─┘
  └─ main.js             ←  „klej”: stan aplikacji + obsługa przycisków
```

## Tabela plików

| Plik | Moduł | Przedmiot / zadanie | Do czego służy |
|------|-------|---------------------|----------------|
| `imageIO.js` | `BioEditor.ImageIO` | Biometria 1 | Wczytanie pliku obrazu, wyświetlenie na kanwie, zapis do PNG, pusta biała kanwa. |
| `imageProcessing.js` | `BioEditor.ImageProcessing` | Biometria 1, 2 | Algorytmy na pikselach: binaryzacja, tablice LUT, rozciąganie i wyrównanie histogramu, próg Otsu, jasność/kontrast, negatyw. |
| `histogram.js` | `BioEditor.Histogram` | Biometria 1, 2 | Liczenie histogramów (R, G, B, średnia) i ręczne rysowanie wykresu na kanwie. |
| `colorSpaces.js` | `BioEditor.ColorSpaces` | Grafika 1b | Przeliczanie kolorów: RGB ↔ CMYK, RGB ↔ HSV, RGB → HEX. |
| `raster.js` | `BioEditor.Raster` | Grafika 1a | Rysowanie pikseli: linia (Bresenham), okrąg (midpoint), prostokąt, wypełniony prostokąt. |
| `shapes.js` | `BioEditor.Shapes` | Grafika 1a | Kształty jako obiekty z parametrami: tworzenie, przesuwanie, uchwyty, trafienie myszą, nakładanie na obraz. |
| `ui.js` | `BioEditor.UI` | wspólne | Małe pomocnicze elementy interfejsu: przełącznik segmentowy, włączanie/wyłączanie przycisków, pasek statusu. |
| `colorPicker.js` | `BioEditor.ColorPicker` | Grafika 1b | Panel „Kolor”: kwadrat i pasek odcienia, suwaki, pola RGB/CMYK, podgląd i wartości po konwersji. |
| `drawingTool.js` | `BioEditor.DrawingTool` | Grafika 1a | Obsługa myszy na obrazie: rysowanie kształtów kliknięciami, zaznaczanie, przesuwanie, zmiana rozmiaru uchwytami. |
| `shapeForm.js` | `BioEditor.ShapeForm` | Grafika 1a | Pola tekstowe z parametrami kształtu: dodawanie nowego, edycja zaznaczonego, usuwanie. |
| `main.js` | – | wszystkie | Stan aplikacji (obraz, kształty, historia Cofnij), odświeżanie widoku, podpięcie wszystkich przycisków i suwaków. |

## Podział odpowiedzialności

- **Algorytmy** (`imageProcessing.js`, `colorSpaces.js`, `raster.js`, `shapes.js`,
  część `histogram.js`) nie dotykają przycisków ani strony. Dostają dane
  i zwracają wynik, więc można je sprawdzić osobno, np. w Node.
- **Interfejs** (`ui.js`, `colorPicker.js`, `drawingTool.js`, `shapeForm.js`)
  obsługuje kliknięcia i pola, ale nie przechowuje dokumentu – zgłasza zmiany
  do `main.js`.
- **`main.js`** jest jedynym miejscem, które trzyma stan dokumentu i historię
  Cofnij.

## Główne zasady w kodzie

- Funkcje przetwarzające obraz **nie zmieniają obrazu wejściowego** – zwracają
  nowy. Dzięki temu działa „Cofnij” i „Przywróć oryginał”.
- Wyjątek: funkcje z `raster.js` rysują bezpośrednio w podanym buforze
  (dlatego `Shapes.composite` zawsze najpierw robi kopię).
- Operacje punktowe (rozciąganie, wyrównanie, jasność, negatyw) liczą
  najpierw tablicę LUT (256 wyników), a potem przechodzą po obrazie jedną pętlą.
- Dokument to **obraz** + **lista kształtów** nad nim. Operacje z biometrii
  zmieniają obraz, a kształty zostają na wierzchu.
