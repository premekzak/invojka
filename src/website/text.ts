/**
 * Czech typography for running text: a one-letter preposition or conjunction (a, i, k, o, s, u, v, z) never ends a
 * line, so the space after it becomes a non-breaking one ("Funguje i bez internetu" must not break after "i").
 * Every sentence the website shows goes through this.
 */
export const cz = (text: string) => text.replace(/(^|[\s(„])([aikosuvzAIKOSUVZ]) /g, '$1$2 ')
