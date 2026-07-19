export const TESTAMENT = {
  OLD: 'OLD',
  NEW: 'NEW',
} as const

export type Testament = (typeof TESTAMENT)[keyof typeof TESTAMENT]

/** First book of the New Testament (Matthew) in the canonical 1-66 index. */
export const FIRST_NEW_TESTAMENT_BOOK = 40

export function testamentOf(book: number): Testament {
  return book < FIRST_NEW_TESTAMENT_BOOK ? TESTAMENT.OLD : TESTAMENT.NEW
}
