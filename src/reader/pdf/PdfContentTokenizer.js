export class PdfContentTokenizer {

  tokenize(contentStr) {
    const tokens = [];
    let i = 0;

    while (i < contentStr.length) {
      const c = contentStr[i];

      // whitespace
      if (/\s/.test(c)) {
        i++;
        continue;
      }

      // comentario PDF: % hasta fin de línea
      if (c === '%') {
        while (i < contentStr.length && contentStr[i] !== '\n' && contentStr[i] !== '\r') i++;
        continue;
      }

      // string literal ( ... )
      if (c === '(') {
        let depth = 1;
        let str = '';
        i++;

        while (i < contentStr.length && depth > 0) {
          const ch = contentStr[i++];

          if (ch === '\\') {
            const next = contentStr[i++] ?? '';
            if      (next === 'n')  str += '\n';
            else if (next === 'r')  str += '\r';
            else if (next === 't')  str += '\t';
            else if (next === 'b')  str += '\b';
            else if (next === 'f')  str += '\f';
            else if (next === '(')  str += '(';
            else if (next === ')')  str += ')';
            else if (next === '\\') str += '\\';
            else if (/[0-7]/.test(next)) {
              // octal: hasta 3 dígitos
              let oct = next;
              for (let d = 0; d < 2; d++) {
                if (contentStr[i] && /[0-7]/.test(contentStr[i])) oct += contentStr[i++];
                else break;
              }
              str += String.fromCharCode(parseInt(oct, 8));
            } else {
              str += next;
            }
            continue;
          }

          if (ch === '(') depth++;
          else if (ch === ')') depth--;

          if (depth > 0) str += ch;
        }

        tokens.push({ type: 'string', value: str });
        continue;
      }

      // hex string < ... >  (distinto de << dict >>)
      if (c === '<' && contentStr[i + 1] !== '<') {
        let hex = '';
        i++;
        while (i < contentStr.length && contentStr[i] !== '>') {
          if (!/\s/.test(contentStr[i])) hex += contentStr[i];
          i++;
        }
        i++; // consume '>'
        // Decodificar pares hex; si longitud impar, se asume 0 al final
        if (hex.length % 2 !== 0) hex += '0';
        let str = '';
        for (let h = 0; h < hex.length; h += 2) {
          const byte = parseInt(hex.slice(h, h + 2), 16);
          if (!isNaN(byte)) str += String.fromCharCode(byte);
        }
        tokens.push({ type: 'string', value: str });
        continue;
      }

      // array [ ... ]
      if (c === '[') {
        let arr = '';
        i++;
        while (i < contentStr.length && contentStr[i] !== ']') {
          arr += contentStr[i++];
        }
        i++;
        tokens.push({ type: 'array', value: arr });
        continue;
      }

      // operator or number
      let word = '';
      while (i < contentStr.length && !/[\s\[\]<>()]/.test(contentStr[i])) {
        word += contentStr[i++];
      }

      if (!word) { i++; continue; } // carácter inesperado, avanzar

      if (/^-?\d+(\.\d+)?$/.test(word)) {
        tokens.push({ type: 'number', value: Number(word) });
      } else {
        tokens.push({ type: 'op', value: word });
      }
    }

    return tokens;
  }
}
