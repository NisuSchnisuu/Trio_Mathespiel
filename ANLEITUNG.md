# Anleitung für Trio - Das Mathespiel

Willkommen bei **Trio**, dem ultimativen Mathe-Battle! Hier geht es um Kopfrechnen, Schnelligkeit und strategisches Denken. Diese Anleitung erklärt dir alle Funktionen, Einstellungen und Regeln der App.

---

## 1. Das Spielprinzip
Das Ziel ist es, in einem Gitter aus Zahlen drei Zahlen zu finden, die mathematisch so kombiniert werden können, dass sie eine **Zielzahl** ergeben.

**Ablauf:**
1.  **Suchen & Buzzern:** Alle Spieler sehen das gleiche Gitter und die gleiche Zielzahl. Wer eine Lösung hat, drückt den **"TRIO!"-Buzzer**.
2.  **Auswählen:** Der Spieler, der gebuzzert hat, muss innerhalb von **10 Sekunden** drei Zahlen im Gitter auswählen.
    *   Die Zahlen müssen **auf einer Linie** liegen (Horizontal, Vertikal oder Diagonal).
    *   Die Abstände zwischen den Zahlen müssen gleich sein (direkt nebeneinander oder immer eine Lücke dazwischen).
3.  **Rechnen:** Ein Taschenrechner öffnet sich. Du musst nun mit den drei ausgewählten Zahlen eine Rechnung erstellen, die genau die Zielzahl ergibt.

---

## 2. Einstellungen & Konfiguration
Bevor ein Spiel startet, kann der Host (der "Spiel-Ersteller") verschiedene Einstellungen vornehmen:

### Haupt-Einstellungen
*   **Schwierigkeit:** Bestimmt, welche Rechenoperationen erlaubt sind (siehe Abschnitt "Schwierigkeitsstufen").
*   **Zahlenraum:**
    *   **1-9 (Ziel bis 50):** Im Gitter kommen nur die Ziffern 1 bis 9 vor. Die Zielzahl ist maximal 50. Ideal für Einsteiger und Grundschule.
    *   **1-20 (Ziel bis 100):** Im Gitter stehen Zahlen bis 20. Die Zielzahl kann bis zu 100 betragen. Für Fortgeschrittene.
*   **Gittergröße:**
    *   **5x5 (Klein):** Weniger Zahlen, übersichtlicher.
    *   **7x7 (Standard):** Die normale Größe.
    *   **9x9 (Groß):** Sehr viele Möglichkeiten, für Profis.
*   **Siegpunkte:** Wie viele Runden muss man gewinnen? (Standard: 10).
*   **Hardcore Modus 🔥:**
    *   Ist dieser Modus aktiv, wird dir bei einer **falschen Antwort ein Punkt abgezogen**!
    *   Ohne Hardcore-Modus passiert nichts (außer einer Zeitsperre).

### Lehrer / Host Funktionen
*   **Beobachten erlauben (Live-Übertragung):**
    *   Wenn aktiviert, können alle anderen Spieler auf ihren Bildschirmen live sehen, was der aktive Spieler gerade in den Taschenrechner eingibt.
    *   Ideal für den Unterricht ("Lösung zeigen").

---

## 3. Schwierigkeitsstufen & Regeln
Hier sind die genauen Regeln für die Formeln. Du darfst immer **nur** die drei ausgewählten Zahlen verwenden.

> **Wichtig:** In allen Modi darfst du keine negativen Zwischenergebnisse als Startzahl haben (z.B. `-5 + ...` ist verboten).

### 🟢 Normal (Einsteiger)
*   **Erlaubte Zeichen:** Plus (`+`), Minus (`-`), Mal (`·`).
*   **Regel:** Es muss **genau eine Mal-Rechnung** (`·`) und **genau eine Strich-Rechnung** (`+` oder `-`) vorkommen.
*   **Beispiele (Zahlen: 3, 4, 5 | Ziel: 17):**
    *   `3 · 4 + 5 = 17` ✅ (Richtig: Ein Mal, ein Plus)
    *   `5 · 4 - 3 = 17` ✅ (Richtig: Ein Mal, ein Minus)
    *   `3 + 4 + 5` ❌ (Falsch: Keine Mal-Rechnung)
    *   `3 · 4 · 5` ❌ (Falsch: Keine Strich-Rechnung)

### 🟡 Fortgeschritten
*   **Erlaubte Zeichen:** Plus (`+`), Minus (`-`), Geteilt (`:`).
*   **Regel:** Es muss **genau eine Geteilt-Rechnung** (`:`) und **genau eine Strich-Rechnung** (`+` oder `-`) vorkommen.
*   **Beispiele (Zahlen: 8, 4, 2 | Ziel: 4):**
    *   `8 : 4 + 2 = 4` ✅
    *   `8 : 2 - 4 = 0` ✅ (Gültige Formel, auch wenn Ziel 0 wäre)
    *   `8 - 4 : 2 = 6` ✅ (Punkt vor Strich wird automatisch beachtet!)

### 🔴 Profi (Experten)
*   **Erlaubte Zeichen:** Alle (`+`, `-`, `·`, `:`, `(`, `)`).
*   **Regel:**
    1.  Du **MUSST Klammern** `( )` verwenden.
    2.  Du musst eine Punktrechnung (`·` oder `:`) und eine Strichrechnung (`+` oder `-`) kombinieren.
    3.  **WICHTIG:** Die Punktrechnung darf **NICHT** in der Klammer stehen! Die Klammer muss eine Summe oder Differenz schützen, die dann mal- oder geteilt-gerechnet wird.
*   **Struktur:** `(Strichrechnung) · Zahl` oder `Zahl · (Strichrechnung)`.
*   **Beispiele (Zahlen: 3, 4, 5 | Ziel: 35):**
    *   `( 3 + 4 ) · 5 = 35` ✅ (Klammer um Plus, dann Mal)
    *   `5 · ( 4 + 3 ) = 35` ✅
    *   `( 3 · 4 ) + 5` ❌ (Falsch: Punktrechnung in der Klammer ist verboten!)
    *   `3 · 4 + 5` ❌ (Falsch: Keine Klammern)

### 🟣 Verrückt (Crazy Mode)
*   Hier ist **alles erlaubt**.
*   **Punktesystem:**
    *   Baust du eine **Profi-Formel**: 3 Punkte.
    *   Baust du eine **Fortgeschrittenen-Formel**: 2 Punkte.
    *   Baust du eine **Normale Formel**: 1 Punkt.

---

## 4. Strafen & Fehlversuche
*   **Falsche Rechnung:** Wenn dein Ergebnis nicht stimmt oder die Formel-Regeln verletzt wurden (z.B. Klammer vergessen im Profi-Modus).
    *   Die Runde endet sofort.
    *   Du bekommst eine **30-Sekunden-Sperre** (Buzzer ist gesperrt).
    *   Im **Hardcore-Modus**: Du verlierst zusätzlich 1 Punkt!
*   **Zu langsam:** Wenn du nach dem Buzzern nicht innerhalb von 10 Sekunden deine 3 Zahlen wählst.
    *   20-Sekunden-Sperre.

---

## 5. Tipps zur App (Funktionen)
*   **Installation (PWA):** Du kannst die App auf deinem Handy oder PC installieren ("Zum Home-Bildschirm hinzufügen"). Das ermöglicht Vollbild und ist schneller.
*   **QR-Code:** Im Lobby-Bereich gibt es einen QR-Code. Freunde können diesen direkt mit ihrer Handy-Kamera scannen, um deinem Spiel beizutreten.
*   **Querformat:** Die App ist für das Querformat (Landscape) optimiert. Bitte drehe dein Gerät.
