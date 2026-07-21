/**
 * Little-endian integer encoders shared by every instruction builder. The
 * widths must match the program's `to_le_bytes()`: a mismatch derives wrong
 * PDAs or garbles instruction data. One definition, one place to get it right.
 */

export function u8(value: number): Buffer {
  const buffer = Buffer.alloc(1)
  buffer.writeUInt8(value, 0)
  return buffer
}

export function u16le(value: number): Buffer {
  const buffer = Buffer.alloc(2)
  buffer.writeUInt16LE(value, 0)
  return buffer
}

export function u32le(value: number): Buffer {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(value, 0)
  return buffer
}
