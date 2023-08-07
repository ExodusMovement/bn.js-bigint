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

  Object.defineProperty(BN.prototype, "negative", {
    get: function () {
      return this.num < 0n ? 1 : 0;
    },
  });

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
    if (typeof number === "number") {
      this.num = BigInt(number);
    } else if (typeof number === "bigint") {
      this.num = number;
    } else if (typeof number === "string") {
      if (base === "hex" || base === 16) {
        var mult = number.startsWith("-") ? -1 : 1;
        if (mult < 0) {
          number = number.substring(1);
        }

        number = number.startsWith("0x") ? number : "0x" + number;
        this.num = BigInt(number) * BigInt(mult);
      } else {
        // Assume other cases are base 10 for simplicity, handle other bases as needed
        this.num = BigInt(number);
      }
    } else if (Array.isArray(number)) {
      this.num = this._initArray(input, endian);
    }
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

  //TODO padding
  BN.prototype.toString = function toString(base, padding) {
    let out = this.num.toString(base);
    // while (out.length % padding !== 0) {
    //   out = "0" + out;
    // }
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
    this.num *= BigInt(n);
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
    return this.num ** b.num;
  };

  BN.prototype.iushln = function iushln(bits) {
    this.num <<= BigInt(bits);
    return this;
  };

  BN.prototype.ishln = function ishln(bits) {
    assert(!this.isNeg());
    return this.iushln(bits);
  };

  BN.prototype.iushrn = function iushrn(bits) {
    this.num >>= BigInt(bits);
    return this;
  };

  BN.prototype.ishrn = function ishrn(bits) {
    // Assuming the number is non-negative
    return this.iushrn(bits);
  };

  // Shift-left
  BN.prototype.shln = function shln(bits) {
    return this.clone().ishln(bits);
  };

  BN.prototype.ushln = function ushln(bits) {
    return this.clone().iushln(bits);
  };

  // Shift-right
  BN.prototype.shrn = function shrn(bits) {
    return this.clone().ishrn(bits);
  };

  BN.prototype.ushrn = function ushrn(bits) {
    return this.clone().iushrn(bits);
  };

  // Test if n bit is set
  BN.prototype.testn = function testn(bit) {
    assert(typeof bit === "number" && bit >= 0);
    return !!(this.num & (1n << BigInt(bit)));
  };

  // Return only lower bits of number (in-place)
  BN.prototype.imaskn = function imaskn(bits) {
    assert(typeof bits === "number" && bits >= 0);
    assert(this.num >= 0n, "imaskn works only with positive numbers");

    const mask = (1n << BigInt(bits)) - 1n;
    this.num = this.num & mask;

    return this;
  };

  // Return only lowers bits of number
  BN.prototype.maskn = function maskn(bits) {
    return this.clone().imaskn(bits);
  };

  // Add plain number `num` to `this`
  BN.prototype.iaddn = function iaddn(num) {
    assert(typeof num === "number");
    return this._iaddn(num);
  };

  BN.prototype._iaddn = function _iaddn(num) {
    this.num += BigInt(num);
    return this;
  };

  // Subtract plain number `num` from `this`
  BN.prototype.isubn = function isubn(num) {
    assert(typeof num === "number");
    this.num -= BigInt(num);
    return this;
  };

  BN.prototype.addn = function addn(num) {
    return this.clone().iaddn(num);
  };

  BN.prototype.subn = function subn(num) {
    return this.clone().isubn(num);
  };

  BN.prototype.iabs = function iabs() {
    this.num = this.num < 0n ? -this.num : this.num;
    return this;
  };

  BN.prototype.abs = function abs() {
    return this.clone().iabs();
  };

  BN.prototype.div = function div(num) {
    assert(!num.isZero()); // Ensure we're not dividing by zero.
    return new BN(this.num / num.num);
  };

  BN.prototype.mod = function mod(num) {
    return this.num % num.num;
  };

  BN.prototype.umod = function umod(num) {
    const result = this.num % num.num;
    return result >= 0 ? result : result + num.num;
  };

  BN.prototype.divRound = function divRound(num) {
    const quotient = this.num / num.num;
    const remainder = this.num % num.num;

    // Check if the remainder is more than half of `num`
    if (2n * remainder >= num.num) {
      return quotient + 1n;
    }
    return quotient;
  };

  BN.prototype.modrn = function modrn(num) {
    let n = BigInt(num);
    let result = this.num % n;

    return result >= 0 ? Number(result) : Number(result + n);
  };

  // WARNING: DEPRECATED
  BN.prototype.modn = function modn(num) {
    return this.modrn(num);
  };

  BN.prototype.idivn = function idivn(num) {
    this.num = this.num / BigInt(num);
    return this;
  };

  BN.prototype.divn = function divn(num) {
    return this.clone().idivn(num);
  };

  BN.prototype.egcd = function egcd(b) {
    let a = this.num;
    b = BigInt(b);

    let [x, y, u, v] = [1n, 0n, 0n, 1n];

    while (b !== 0n) {
      let q = a / b;
      [a, b] = [b, a % b];
      [x, u] = [u, x - u * q];
      [y, v] = [v, y - v * q];
    }

    return {
      gcd: a,
      x: x,
      y: y,
    };
  };

  BN.prototype.gcd = function gcd(num) {
    let a = this.num;
    let b = BigInt(num);

    while (b !== 0n) {
      let temp = b;
      b = a % b;
      a = temp;
    }

    return a;
  };

  BN.prototype.invm = function invm(num) {
    const result = this.egcd(BigInt(num)).x;
    return ((result % BigInt(num)) + BigInt(num)) % BigInt(num); // Ensure non-negative result
  };

  BN.prototype.isEven = function isEven() {
    return (this.num & 1n) === 0n;
  };

  BN.prototype.isOdd = function isOdd() {
    return (this.num & 1n) === 1n;
  };

  BN.prototype.andln = function andln(num) {
    return Number(this.num & BigInt(num));
  };

  BN.prototype.bincn = function bincn(bit) {
    assert(typeof bit === "number");

    // Construct a BigInt with only the specified bit set to 1
    let increment = 1n << BigInt(bit);

    // Increment the BN's value by the constructed BigInt
    this.num += increment;

    return this;
  };

  BN.prototype.isZero = function isZero() {
    return this.num === 0n;
  };

  BN.prototype.cmpn = function cmpn(num) {
    num = BigInt(num);

    if (this.num > num) {
      return 1;
    } else if (this.num < num) {
      return -1;
    } else {
      return 0;
    }
  };

  BN.prototype.gtn = function gtn(num) {
    return this.cmpn(num) === 1;
  };

  BN.prototype.gt = function gt(num) {
    return this.cmp(num) === 1;
  };

  BN.prototype.gten = function gten(num) {
    return this.cmpn(num) >= 0;
  };

  BN.prototype.gte = function gte(num) {
    return this.cmp(num) >= 0;
  };

  BN.prototype.ltn = function ltn(num) {
    return this.cmpn(num) === -1;
  };

  BN.prototype.lt = function lt(num) {
    return this.cmp(num) === -1;
  };

  BN.prototype.lten = function lten(num) {
    return this.cmpn(num) <= 0;
  };

  BN.prototype.lte = function lte(num) {
    return this.cmp(num) <= 0;
  };

  BN.prototype.eqn = function eqn(num) {
    return this.cmpn(num) === 0;
  };

  BN.prototype.eq = function eq(num) {
    return this.cmp(num) === 0;
  };

  BN.prototype.cmp = function cmp(other) {
    if (this.num > other.num) return 1;
    if (this.num < other.num) return -1;
    return 0;
  };
})(typeof module === "undefined" || module, this);
