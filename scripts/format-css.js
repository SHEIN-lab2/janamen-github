'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'public');
const cssDirectory = path.join(root, 'css');
const files = [
  path.join(root, 'styles.css'),
  ...fs
    .readdirSync(cssDirectory)
    .filter((file) => file.endsWith('.css'))
    .map((file) => path.join(cssDirectory, file)),
];
const mode = process.argv[2];
if (mode !== '--write' && mode !== '--check') {
  throw Error('Usage: node scripts/format-css.js --write|--check');
}

function skipComment(source, start) {
  const end = source.indexOf('*/', start + 2);
  if (end === -1) throw Error('Unterminated CSS comment');
  return end + 2;
}

function findBlockEnd(source, start) {
  let depth = 1;
  let quote = '';

  for (let index = start; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (character === '\\') index++;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '/' && source[index + 1] === '*') {
      index = skipComment(source, index) - 1;
      continue;
    }
    if (character === '{') depth++;
    if (character === '}' && --depth === 0) return index;
  }

  throw Error('Unclosed CSS block');
}

function normalizeWhitespace(value) {
  let result = '';
  let quote = '';
  let pendingSpace = false;

  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (quote) {
      result += character;
      if (character === '\\' && index + 1 < value.length) result += value[++index];
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      if (pendingSpace && result) result += ' ';
      pendingSpace = false;
      quote = character;
      result += character;
    } else if (/\s/.test(character)) {
      pendingSpace = true;
    } else {
      if (pendingSpace && result) result += ' ';
      pendingSpace = false;
      result += character;
    }
  }

  return result.trim();
}

function splitDeclarations(block) {
  const declarations = [];
  let start = 0;
  let parentheses = 0;
  let quote = '';

  for (let index = 0; index < block.length; index++) {
    const character = block[index];
    if (quote) {
      if (character === '\\') index++;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '/' && block[index + 1] === '*') {
      index = skipComment(block, index) - 1;
    } else if (character === '(') parentheses++;
    else if (character === ')') parentheses--;
    else if (character === ';' && parentheses === 0) {
      const declaration = normalizeWhitespace(block.slice(start, index));
      if (declaration) declarations.push(`${declaration};`);
      start = index + 1;
    }
  }

  const finalDeclaration = normalizeWhitespace(block.slice(start));
  if (finalDeclaration) declarations.push(finalDeclaration);
  return declarations;
}

function formatDeclarations(block, indent) {
  const declarations = splitDeclarations(block);
  if (!declarations.length) return [];

  const lines = [];
  let line = ' '.repeat(indent);
  for (const declaration of declarations) {
    const separator = line.trim() ? ' ' : '';
    if (line.length + separator.length + declaration.length > 100 && line.trim()) {
      lines.push(line);
      line = ' '.repeat(indent) + declaration;
    } else {
      line += separator + declaration;
    }
  }
  lines.push(line);
  return lines;
}

function formatStyleRule(prelude, block, indent) {
  const declarations = splitDeclarations(block);
  const padding = ' '.repeat(indent);
  const inline = declarations.join(' ');
  const singleLine = declarations.length
    ? `${padding}${prelude} { ${inline} }`
    : `${padding}${prelude} {}`;

  if (singleLine.length <= 100) return [singleLine];
  return [`${padding}${prelude} {`, ...formatDeclarations(block, indent + 2), `${padding}}`];
}

function formatRules(source, indent = 0) {
  const lines = [];
  let index = 0;

  while (index < source.length) {
    while (/\s/.test(source[index] || '') && index < source.length) index++;
    if (index >= source.length) break;

    if (source.startsWith('/*', index)) {
      const end = skipComment(source, index);
      if (lines.length && lines.at(-1) !== '') lines.push('');
      lines.push(' '.repeat(indent) + source.slice(index, end).trim());
      index = end;
      continue;
    }

    const start = index;
    let quote = '';
    let parentheses = 0;
    while (index < source.length) {
      const character = source[index];
      if (quote) {
        if (character === '\\') index++;
        else if (character === quote) quote = '';
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '/' && source[index + 1] === '*') {
        index = skipComment(source, index) - 1;
      } else if (character === '(') {
        parentheses++;
      } else if (character === ')') {
        parentheses--;
      } else if (parentheses === 0 && (character === '{' || character === ';')) {
        break;
      } else if (character === '}' && parentheses === 0) {
        break;
      }
      index++;
    }

    const prelude = normalizeWhitespace(source.slice(start, index));
    if (source[index] === ';') {
      lines.push(' '.repeat(indent) + prelude + ';');
      index++;
      continue;
    }
    if (source[index] === '}') throw Error(`Unexpected closing brace near: ${prelude}`);
    if (source[index] !== '{') throw Error(`Invalid CSS rule near: ${prelude}`);

    const closingBrace = findBlockEnd(source, index + 1);
    const block = source.slice(index + 1, closingBrace);
    if (prelude.startsWith('@')) {
      if (lines.length && lines.at(-1) !== '') lines.push('');
      lines.push(' '.repeat(indent) + `${prelude} {`);
      lines.push(...formatRules(block, indent + 2));
    } else {
      if (lines.length && lines.at(-1) !== '') lines.push('');
      lines.push(...formatStyleRule(prelude, block, indent));
    }
    if (prelude.startsWith('@')) lines.push(' '.repeat(indent) + '}');
    index = closingBrace + 1;
  }

  return lines;
}

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const formatted = formatRules(original).join('\n') + '\n';

  if (mode === '--check') {
    if (original !== formatted) {
      console.error(`CSS formatting differs: ${path.relative(root, file)}`);
      process.exitCode = 1;
    }
  } else {
    fs.writeFileSync(file, formatted);
    console.log(`Formatted ${path.relative(root, file)}`);
  }
}
