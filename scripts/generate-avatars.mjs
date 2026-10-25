import { mkdir, writeFile } from 'node:fs/promises';

// Original vector animal portraits, kept local so avatars need no external service.
const circle = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const ellipse = (x, y, rx, ry, fill) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
const path = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
const roundEars = color => circle(19, 22, 12, color) + circle(61, 22, 12, color);
const pointEars = color => path('M14 34 14 9 34 24M46 24 66 9 66 34', color);
const portraits = [
  ['cat', '#e8efff', '#e8b981', pointEars('#e8b981'), path('M18 26 18 16 27 24M53 24 62 16 62 26', '#f2c2bb'), ''],
  ['dog', '#e1f3f0', '#f1d4ac', ellipse(17, 37, 10, 22, '#926846') + ellipse(63, 37, 10, 22, '#926846'), '', ellipse(51, 39, 10, 13, '#bc926b')],
  ['bear', '#fae9db', '#bb8d6c', roundEars('#bb8d6c'), circle(19, 22, 6, '#edcdb3') + circle(61, 22, 6, '#edcdb3'), ellipse(40, 53, 17, 12, '#edd2b8')],
  ['rabbit', '#f6e5f1', '#fff6ef', ellipse(27, 19, 9, 22, '#fff6ef') + ellipse(53, 19, 9, 22, '#fff6ef'), ellipse(27, 17, 4, 15, '#f0b7ca') + ellipse(53, 17, 4, 15, '#f0b7ca'), ''],
  ['fox', '#e4efff', '#ed9e55', pointEars('#bc7040'), path('M18 26 18 15 28 25M52 25 62 15 62 26', '#f9d2ab'), path('M13 43Q27 37 40 55Q53 37 67 43Q64 69 40 70Q16 69 13 43', '#fff5e6')],
  ['panda', '#e6f1e5', '#fffdf7', roundEars('#3b4658'), '', ellipse(28, 40, 10, 12, '#3b4658') + ellipse(52, 40, 10, 12, '#3b4658')],
  ['koala', '#ece7fa', '#a4b1c2', roundEars('#a4b1c2'), circle(19, 22, 8, '#e3d9e5') + circle(61, 22, 8, '#e3d9e5'), ellipse(40, 47, 9, 13, '#39445b')],
  ['pig', '#f9eadb', '#f2b4be', pointEars('#e798a9'), '', ellipse(40, 53, 15, 10, '#e792a6') + circle(35, 53, 2, '#a9506e') + circle(45, 53, 2, '#a9506e')],
  ['tiger', '#fff0ce', '#efb45e', roundEars('#efb45e'), circle(19, 22, 6, '#ffe4bd') + circle(61, 22, 6, '#ffe4bd'), path('M34 15H39L38 29 34 23M42 15H47L45 28 42 23M13 35 25 39 14 43M67 35 55 39 66 43', '#8f5b35')],
  ['lion', '#e4f0ff', '#f0c675', circle(40, 41, 36, '#bf8250'), '', ellipse(40, 53, 16, 11, '#ffe3a2')],
  ['frog', '#e5f5ed', '#8fc692', circle(24, 24, 14, '#8fc692') + circle(56, 24, 14, '#8fc692'), circle(24, 24, 8, '#fffbea') + circle(56, 24, 8, '#fffbea') + circle(24, 24, 3, '#35475a') + circle(56, 24, 3, '#35475a'), ''],
  ['penguin', '#e4effa', '#41536f', '', '', ellipse(40, 46, 24, 26, '#fff9ed')],
];
const directory = new URL('../public/avatars/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const [name, background, fur, ears, innerEars, markings] of portraits) {
  const eyes = name === 'frog' ? '' : circle(29, 40, 2.8, name === 'panda' ? '#fff' : '#354052') + circle(51, 40, 2.8, name === 'panda' ? '#fff' : '#354052');
  const nose = ['frog', 'pig', 'koala'].includes(name) ? '' : name === 'penguin' ? path('M34 48 46 48 40 55Z', '#edb457') : ellipse(40, 49, 4, 3, '#654e50');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><clipPath id="round"><circle cx="40" cy="40" r="40"/></clipPath></defs><g clip-path="url(#round)">${circle(40, 40, 40, background)}${ears}${innerEars}${ellipse(40, 43, name === 'lion' ? 27 : 29, 28, fur)}${markings}${eyes}${nose}${circle(22, 51, 4, '#eaa4a4')}${circle(58, 51, 4, '#eaa4a4')}<path d="M33 58Q40 64 47 58" fill="none" stroke="#654e50" stroke-width="2" stroke-linecap="round"/></g></svg>`;
  await writeFile(new URL(`${name}.svg`, directory), svg);
}
