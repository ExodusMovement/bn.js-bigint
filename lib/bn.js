(function (module, exports) {
  "use strict";

  // Utils
  function assert(val, msg) {
    if (!val) throw new Error(msg || "Assertion failed");
  }

  // Could use `inherits` module, but don't want to move from single file
  // architecture yet.
  function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    var TempCtor = function () {};
    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  }

  function BN(number, base, endian) {
    if (BN.isBN(number)) {
      this.num = number.num; // Copy the BigInt value
      return number;
    }

    this.red = null; // Reduction context

    if (number !== null) {
      if (base === "le" || base === "be") {
        endian = base;
        base = 10;
      }
      this._init(number || 0, base || 10, endian || "be");
    }
  }
  if (typeof module === "object") {
    module.exports = BN;
  } else {
    exports.BN = BN;
  }

  BN.BN = BN;

  var Buffer;
  try {
    if (typeof window !== "undefined" && typeof window.Buffer !== "undefined") {
      Buffer = window.Buffer;
    } else {
      Buffer = require("buffer").Buffer;
    }
  } catch (e) {}

  BN.isBN = function isBN(num) {
    if (num instanceof BN) {
      return true;
    }

    return (
      num !== null && typeof num === "object" && typeof num.num === "bigint"
    );
  };

  BN.max = function max(left, right) {
    if (left.cmp(right) > 0) return left;
    return right;
  };

  BN.min = function min(left, right) {
    if (left.cmp(right) < 0) return left;
    return right;
  };

  BN.prototype._init = function init(number, base, endian) {
    console.log('1', typeof number)
    
    if (typeof number === "number") {
      this.num = BigInt(number);
    }

    if (typeof number === "bigint") {
      this.num = number;
    }

    if (typeof number === "string") {
      if (base === "hex" || base === 16) {
        number = number.startsWith("0x") ? number : "0x" + number;
        this.num = BigInt(number);
      } else {
        // Assume other cases are base 10 for simplicity, handle other bases as needed
        this.num = BigInt(number);
      }
    }

    console.log(typeof number, this.toString());

    if (Array.isArray(number)) {
      this.num = this._initArray(input, endian);
    }

    console.log(typeof number, this.toString());
    return this;
  };

  BN.prototype._initArray = function (arr, endian) {
    if (endian !== "be" && endian !== "le") {
      throw new Error("Unsupported endianess");
    }

    if (endian === "le") {
      arr = arr.reverse();
    }

    var hexStr =
      "0x" + arr.map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return BigInt(hexStr);
  };

  BN.prototype.copy = function (dest) {
    dest.num = this.num;
    dest.red = this.red;
  };

  BN.prototype._move = function (dest) {
    this.copy(dest);
  };

  BN.prototype.clone = function () {
    const clone = new BN();
    this.copy(clone);
    return clone;
  };

  BN.prototype.toString = function toString(base, padding) {
    let out = this.num.toString(base);
    while (out.length % padding !== 0) {
      out = "0" + out;
    }
    return out;
  };

  BN.prototype.toNumber = function toNumber() {
    // Ensure the BigInt value can be safely represented as a JS number
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    const minSafe = BigInt(Number.MIN_SAFE_INTEGER);

    if (this.num > maxSafe || this.num < minSafe) {
      throw new Error(
        "The BigInt value is out of the range of safe JavaScript numbers"
      );
    }
    return Number(this.num);
  };

  BN.prototype.toJSON = function toJSON() {
    return this.toString(16, 2);
  };

  if (Buffer) {
    BN.prototype.toBuffer = function toBuffer(endian, length) {
      return this.toArrayLike(Buffer, endian, length);
    };
  }

  BN.prototype.toArray = function toArray(endian, length) {
    return this.toArrayLike(Array, endian, length);
  };

  BN.prototype.toArrayLike = function toArrayLike(
    ArrayType,
    endian = "le",
    length
  ) {
    const hex = this.num.toString(16);
    let bytes = [];

    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }

    if (endian === "be") {
      bytes = bytes.reverse();
    }

    while (length && bytes.length < length) {
      bytes.push(0);
    }

    return new ArrayType(bytes);
  };

  BN.prototype.bitLength = function bitLength() {
    return this.toString(2).length;
  };

  // Number of trailing zeros in a BigInt
  BN.prototype.zeroBits = function () {
    if (this === 0n) return 0;
    let z = 0;
    let temp = this;
    while ((temp & 1n) === 0n) {
      temp >>= 1n;
      z++;
    }
    return z;
  };

  // Compute byte length
  BN.prototype.byteLength = function () {
    return Math.ceil(Number(this.bitLength()) / 8);
  };

  // Convert to two's complement
  BN.prototype.toTwos = function (width) {
    if (this < 0n) {
      return (this.abs() ^ ((1n << BigInt(width)) - 1n)) + 1n;
    }
    return this;
  };

  // Convert from two's complement
  BN.prototype.fromTwos = function (width) {
    if ((this & (1n << BigInt(width - 1))) !== 0n) {
      return this - (1n << BigInt(width));
    }
    return this;
  };

  // Check if negative
  BN.prototype.isNeg = function () {
    return this.num < 0n;
  };

  BN.prototype.neg = function () {
    return new BN(-this.num);
  };

  BN.prototype.ineg = function () {
    this.num = -this.num;
    return this;
  };

  BN.prototype.iuor = function iuor(num) {
    this.num = this.num | num.num;
    return this;
  };

  BN.prototype.ior = function ior(num) {
    return this.iuor(num);
  };

  BN.prototype.or = function or(num) {
    return new BN(this.num | num.num);
  };

  BN.prototype.uor = function uor(num) {
    return this.or(num);
  };

  BN.prototype.iuand = function iuand(num) {
    this.num = this.num & num.num;
    return this;
  };

  BN.prototype.iand = function iand(num) {
    if (this.isNeg() || num.isNeg()) {
      throw new Error("Negative values are not supported for this operation");
    }
    return this.iuand(num);
  };

  BN.prototype.and = function and(num) {
    return new BN(this.num & num.num);
  };

  BN.prototype.uand = function uand(num) {
    return this.and(num);
  };

  BN.prototype.iuxor = function iuxor(num) {
    this.num = this.num ^ num.num;
    return this;
  };

  BN.prototype.ixor = function ixor(num) {
    if (this.isNeg() || num.isNeg()) {
      throw new Error("Negative values are not supported for this operation");
    }
    return this.iuxor(num);
  };

  // Bitwise XOR with num, returning a new BN
  BN.prototype.xor = function xor(num) {
    return new BN(this.num ^ num.num);
  };

  BN.prototype.uxor = function uxor(num) {
    return this.xor(num);
  };

  // In-place bitwise NOT of width bits
  BN.prototype.inotn = function inotn(width) {
    if (typeof width !== "number" || width < 0) {
      throw new Error("Width must be a non-negative number.");
    }

    let mask = (1n << BigInt(width)) - 1n; // Create a mask of width bits set to 1
    this.num = ~this.num & mask;

    return this;
  };

  BN.prototype.notn = function notn(width) {
    return new BN(~this.num).inotn(width);
  };

  // Set or unset a bit at a particular position
  BN.prototype.setn = function setn(bit, val) {
    if (typeof bit !== "number" || bit < 0) {
      throw new Error("Bit must be a non-negative number.");
    }

    let mask = 1n << BigInt(bit);

    if (val) {
      this.num |= mask; // set bit
    } else {
      this.num &= ~mask; // unset bit
    }

    return this;
  };

  BN.prototype.iadd = function iadd(b) {
    this.num += b.num;
    return this;
  };

  // Non in-place addition
  BN.prototype.add = function add(b) {
    return new BN(this.num + b.num);
  };

  // In-place subtraction
  BN.prototype.isub = function isub(b) {
    this.num -= b.num;
    return this;
  };

  // Non in-place subtraction
  BN.prototype.sub = function sub(b) {
    return new BN(this.num - b.num);
  };

  BN.prototype.mulTo = function mulTo(b) {
    return new BN(this.num * b.num);
  };

  BN.prototype.mul = function mul(num) {
    return new BN(this.num * num.num);
  };

  BN.prototype.imul = function imul(num) {
    this.num *= num.num;
    return this;
  };

  BN.prototype.imuln = function imuln(n) {
    const isNegNum = n < 0;
    this.num *= BigInt(n);
    if (isNegNum) {
      this.num = -this.num;
    }
    return this;
  };

  BN.prototype.muln = function muln(n) {
    return this.clone().imuln(n);
  };

  BN.prototype.sqr = function sqr() {
    return this.mul(this);
  };

  BN.prototype.isqr = function isqr() {
    return this.imul(this.clone());
  };

  BN.prototype.pow = function pow(b) {
    return this.num.pow(b);
  };

  BN.prototype.cmp = function cmp(other) {
    if (this.num > other.num) return 1;
    if (this.num < other.num) return -1;
    return 0;
  };
})(typeof module === "undefined" || module, this);
