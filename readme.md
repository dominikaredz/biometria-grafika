Projekt z przedmiotu biometria i grafika komputerowa. Polega na przygotowaniu edytora
graficznego który będzie realizował takie funkcje jak: histogram, binaryzacja,
filtracja itd. Różne algorytmy pracy nad obrazem.
 
DECYZJE TECHNICZNE
- Technologia: HTML + CSS + czysty JavaScript (bez TypeScript),
  aplikacja webowa, bez backendu.
- Powód: projekt będzie później łączony z projektem drugiej osoby,
  która pracuje w JS.
- Wszystkie frameworki i języki są akceptowane przez prowadzącego.
- Znajomość użytkownika: JS (dobra), C# (dobra), C++ (słaba),
  Python (podstawowa). Nie zna Javy.
 
ZASADY
- Zakaz używania gotowych bibliotek do operacji na obrazie
  (binaryzacja, histogram, filtry itd. piszemy samodzielnie).
- Dozwolone są tylko mechanizmy przeglądarki do wczytania, wyświetlenia
  i zapisu obrazu (<input type="file">, Canvas, getImageData/putImageData,
  canvas.toBlob).
- Histogram rysujemy ręcznie na Canvas, bez bibliotek do wykresów.
- Kod ma być modularny i czytelny, bo będzie rozbudowywany o kolejne
  zadania i łączony z innym projektem (osobne moduły/pliki dla funkcji
  przetwarzania obrazu, UI i histogramu).
 
STYL PRACY
- Odpowiadaj po polsku.
- Użytkownik zna JS, ale dla kontekstu i edukacji dodaj wytłumaczenie używanych funkcji i algorytmów
- Pisz w czystym JS (ES6+), bez TypeScript i bez bundlerów, o ile nie
  ustalono inaczej.
- Algorytmy pisz od zera na tablicy pikseli (Uint8ClampedArray),
  dbając o wydajność (jedna pętla po buforze, bez operacji na
  pojedynczych pikselach przez Canvas API).
