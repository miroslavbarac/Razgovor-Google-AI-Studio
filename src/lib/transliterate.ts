const latinToCyrMap: Record<string, string> = {
  'A': 'А', 'a': 'а', 'B': 'Б', 'b': 'б', 'V': 'В', 'v': 'в', 'G': 'Г', 'g': 'г', 'D': 'Д', 'd': 'д',
  'Đ': 'Ђ', 'đ': 'ђ', 'E': 'Е', 'e': 'е', 'Ž': 'Ж', 'ž': 'ж', 'Z': 'З', 'z': 'з', 'I': 'И', 'i': 'и',
  'J': 'Ј', 'j': 'ј', 'K': 'К', 'k': 'к', 'L': 'Л', 'l': 'л', 'Lj': 'Љ', 'lj': 'љ', 'M': 'М', 'm': 'м',
  'N': 'Н', 'n': 'н', 'Nj': 'Њ', 'nj': 'њ', 'O': 'О', 'o': 'о', 'P': 'П', 'p': 'п', 'R': 'Р', 'r': 'р',
  'S': 'С', 's': 'с', 'T': 'Т', 't': 'т', 'Ć': 'Ћ', 'ć': 'ћ', 'U': 'У', 'u': 'у', 'F': 'Ф', 'f': 'ф',
  'H': 'Х', 'h': 'х', 'C': 'Ц', 'c': 'ц', 'Č': 'Ч', 'č': 'ч', 'Dž': 'Џ', 'dž': 'џ', 'Š': 'Ш', 'š': 'ш'
};

// Complex digraphs need to be handled carefully
export function toCyrillic(text: string): string {
  let res = text;
  // Handle digraphs first (case sensitive order)
  res = res.replace(/DŽ/g, 'Џ')
           .replace(/Dž/g, 'Џ')
           .replace(/dž/g, 'џ')
           .replace(/LJ/g, 'Љ')
           .replace(/Lj/g, 'Љ')
           .replace(/lj/g, 'љ')
           .replace(/NJ/g, 'Њ')
           .replace(/Nj/g, 'Њ')
           .replace(/nj/g, 'њ')
           .replace(/DJ/g, 'Ђ')
           .replace(/Dj/g, 'Ђ')
           .replace(/dj/g, 'ђ');

  return res.split('').map(char => latinToCyrMap[char] || char).join('');
}

export function toLatin(text: string): string {
  // Speech engines usually return Latin for Serbian, so this is less common to need
  return text; // Placeholder or implement reverse if needed.
}
