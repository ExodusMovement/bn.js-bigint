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
      return number;
    }else if(typeof number === 'bigint'){
      this.red = null; // Reduction context

      this.num = number
    }

    this.red = null; // Reduction context

    if (number !== null) {
      if (base === "le" || base === "be") {
        endian = base;
        base = 10;
      }
      this._init(number || 0, base || 10, endian || "be");
    } else {
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

  BN.prototype._validBase = function _validBase(input, base) {
    switch (base) {
      case 10:
        return /^[0-9]+$/.test(input);
      case "hex":
      case 16:
        return /^[0-9a-fA-F]+$/.test(input);
      case 8:
        return /^[0-7]+$/.test(input);
      case 2:
        return /^[01]+$/.test(input);
      case 36:
        return /^[0-9a-zA-Z]+$/.test(input); // this handles base 36
      default:
        throw new Error(`Base ${base} is not supported`);
    }
  };

  BN.prototype._init = function init(number, base, endian) {
    if (Array.isArray(number) || Buffer.isBuffer(number)) {
      if (number.length === 0) {
        this.num = BigInt(0);
        return;
      }
      const byteArray = [...number]; // Copy the array
      if (endian === "le") {
        byteArray.reverse();
      }
      const hexStr = byteArray
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      this.num = BigInt("0x" + hexStr);
      return;
    }

    let isNegative = false;

    const type = typeof number;

    number = number.toString().replace(/\s+/g, "");
    if (number.startsWith("-")) {
      isNegative = true;
      number = number.slice(1);
    }

    if (!this._validBase(number.toString(), base)) {
      throw new Error("Invalid character");
    }

    if (endian === "le" && type === "number") {
      const byteArray = this._toByteArray(BigInt(number));
      byteArray.reverse(); // Reverse the byte order
      const hexStr = byteArray
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      this.num = BigInt("0x" + hexStr);
    } else {
      if (type === "number") {
        assert(number < 0x20000000000000);
      }
      let prefix = "";
      switch (base) {
        case 2:
          prefix = "0b";
          break;
        case 8:
          prefix = "0o";
          break;
        case "hex":
        case 16:
          prefix = "0x";
          if (endian === "le") {
            number = number.length % 2 === 0 ? number : "0" + number;
            number = number
              .match(/.{1,2}/g)
              .reverse()
              .join("");
          }

          break;
        case 36:
          this.num = this._base36ToBigInt(number.toLowerCase());
          break;
        case 10:
        default:
          this.num = BigInt(number);
      }
      if (!this.num) {
        number = number.startsWith(prefix) ? number : prefix + number;
        this.num = BigInt(number);
      }
    }
    if (isNegative) {
      this.num = -this.num;
    }
  };

  BN.prototype._toByteArray = function _toByteArray(number) {
    let hexStr = number.toString(16);
    if (hexStr.length % 2) hexStr = "0" + hexStr; // pad if needed
    const byteArray = [];
    for (let i = 0; i < hexStr.length; i += 2) {
      byteArray.push(parseInt(hexStr.slice(i, i + 2), 16));
    }
    return byteArray;
  };

  BN.prototype._base36ToBigInt = function _base36ToBigInt(str) {
    const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
    let result = BigInt(0);
    for (let char of str) {
      result = result * BigInt(36) + BigInt(chars.indexOf(char));
    }
    return result;
  };

  BN.prototype.copy = function (dest) {
    dest.num = this.num;
    dest.red = this.red;
  };

  BN.prototype._move = function (dest) {
    this.copy(dest);
  };

  function move(dest, src) {
    dest.num = src.num;
    dest.red = src.red;
  }

  BN.prototype.clone = function () {
    const clone = new BN();
    this.copy(clone);
    return clone;
  };

  BN.prototype.toString = function toString(base, padding) {
    base = base || 10;
    if (base === "hex") base = 16;

    padding = padding | 0 || 1;
    let out = this.num.toString(base);

    if (this.negative !== 0) {
      out = out.substring(1);
    }

    while (out.length % padding !== 0) {
      out = "0" + out;
    }
    if (this.negative !== 0) {
      out = "-" + out;
    }

    return out;
  };

  BN.prototype.toNumber = function toNumber() {
    // Ensure the BigInt value can be safely represented as a JS number
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    const minSafe = BigInt(Number.MIN_SAFE_INTEGER);

    if (this.num > maxSafe || this.num < minSafe) {
      throw new Error("Number can only safely store up to 53 bits");
    }
    return Number(this.num);
  };

  BN.prototype.toJSON = function toJSON() {
    return this.toString(16, 2);
  };

  if (Buffer) {
    BN.prototype.toBuffer = function toBuffer(endian, length) {
      return Buffer.from(this.toArrayLike(endian, length));
    };
  }

  BN.prototype.toArray = function toArray(endian, length) {
    return this.toArrayLike(endian, length);
  };

  BN.prototype.toArrayLike = function toArrayLike(endian, length) {
    let hex = this.num.toString(16);

    // Padding the hex string
    if (hex.length % 2 !== 0) {
      hex = "0" + hex;
    }

    let bytes = [];

    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }

    while (length && bytes.length < length) {
      bytes.unshift(0); // Pad with zeros in the front
    }

    // Check if natural length exceeds desired length
    if (length && bytes.length > length) {
      throw new Error("byte array longer than desired length");
    }

    // Reverse the bytes for little endian
    if (endian === "le") {
      bytes = bytes.reverse();
    }

    return bytes;
  };

  BN.prototype.bitLength = function bitLength() {
    if (this.num === 0n) {
      return 0;
    }
    return this.toString(2).length;
  };

  BN.prototype.zeroBits = function () {
    if (this.num === 0n) return 0; // Updated this line
    let z = 0;
    let temp = this.num; // Updated this line
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
    if (this.num < 0n) {
      return (this.abs().num ^ ((1n << BigInt(width)) - 1n)) + 1n;
    }
    return this;
  };

  // Convert from two's complement
  BN.prototype.fromTwos = function (width) {
    if ((this.num & (1n << BigInt(width - 1))) !== 0n) {
      this.num = this.num - (1n << BigInt(width));
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
    assert((this.negative | num.negative) === 0);
    return this.iuand(num);
  };

  BN.prototype.and = function and(num) {
    return this.clone().iand(num);
  };

  BN.prototype.uand = function uand(num) {
    return this.clone().iuand(num);
  };

  BN.prototype.iuxor = function iuxor(num) {
    this.num = this.num ^ num.num;
    return this;
  };

  BN.prototype.ixor = function ixor(num) {
    assert((this.negative | num.negative) === 0);
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
    assert(typeof width === "number" && width >= 0);
    let mask = (1n << BigInt(width)) - 1n; // Create a mask of width bits set to 1
    this.num = ~this.num & mask;

    return this;
  };

  BN.prototype.notn = function notn(width) {
    return this.clone().inotn(width);
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

  BN.prototype.add = function add(b) {
    return this.clone().iadd(b);
  };

  BN.prototype.isub = function isub(b) {
    this.num -= b.num;
    return this;
  };

  BN.prototype.sub = function sub(b) {
    return this.clone().isub(b);
  };

  BN.prototype.mulTo = function mulTo(b) {
    return this.mul(b);
  };

  BN.prototype.mulf = function mulf(num) {
    return this.mul(num);
  };

  BN.prototype.mul = function mul(num) {
    return this.clone().imul(num);
  };

  BN.prototype.imul = function imul(num) {
    this.num *= num.num;
    return this;
  };

  BN.prototype.imuln = function imuln(n) {
    assert(typeof n === "number");
    assert(n < 0x4000000);
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
    return new BN(this.num ** b.num);
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
    assert(num < 0x4000000);
    return this._iaddn(num);
  };

  BN.prototype._iaddn = function _iaddn(num) {
    this.num += BigInt(num);
    return this;
  };

  // Subtract plain number `num` from `this`
  BN.prototype.isubn = function isubn(num) {
    assert(typeof num === "number");
    assert(num < 0x4000000);
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

    if (this.isZero()) return new BN(0);
    return new BN(this.num / num.num);
  };

  BN.prototype.mod = function mod(num) {
    return new BN(this.num % num.num);
  };

  BN.prototype.umod = function umod(num) {
    const result = this.num % num.num;
    if (result >= 0n) {
      return new BN(result);
    }
    return new BN(result + (num.num < 0n ? -num.num : num.num));
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
    const isNegNum = num < 0;
    const absNum = BigInt(isNegNum ? -num : num);
    assert(absNum <= 0x3ffffffn);
    const p = (1n << 26n) % absNum;
    let acc = 0n;
    acc = (p * acc + this.num) % absNum;
    return isNegNum ? new BN(-acc) : new BN(acc);
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
    assert(b.negative === 0);
    assert(!b.isZero());
    let a = this.abs().num;
    b = BigInt(b.abs().num);

    let [x, y, u, v] = [1n, 0n, 0n, 1n];

    while (b !== 0n) {
      let q = a / b;
      [a, b] = [b, a % b];
      [x, u] = [u, x - u * q];
      [y, v] = [v, y - v * q];
    }

    return {
      gcd: new BN(a),
      a: new BN(x),
      b: new BN(y),
    };
  };

  BN.prototype.gcd = function gcd(num) {
    let a = this.abs().num;
    let b = BigInt(num.abs().num);

    while (b !== 0n) {
      let temp = b;
      b = a % b;
      a = temp;
    }

    return new BN(a);
  };

  // Invert number in the field F(num)
  BN.prototype.invm = function invm(num) {
    return this.egcd(num).a.umod(num);
  };

  BN.prototype._invmp = function _invmp(p) {
    if (p.num <= 0n) throw new Error("Invalid modulus");

    let a = this.num;
    let mod = p.num;

    if (a < 0n) a = ((a % mod) + mod) % mod;

    let [x1, x2] = [1n, 0n];
    let [y1, y2] = [0n, 1n];

    while (a > 0n) {
      let [q, r] = [mod / a, mod % a];
      [x1, x2] = [x2, x1 - q * x2];
      [y1, y2] = [y2, y1 - q * y2];
      mod = a;
      a = r;
    }

    if (mod === 1n) {
      return new BN(y1 < 0n ? y1 + p.num : y1);
    }

    throw new Error("Inverse does not exist");
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

  BN.prototype.cmpn = function cmpn(n) {
    assert(n <= 0x3ffffff, "Number is too big");
    const other = BigInt(n);

    if (this.num > other) return 1;
    if (this.num < other) return -1;
    return 0;
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

  BN.prototype.ucmp = function (other) {
    if (this.num < 0n && other.num >= 0n) return -1;
    if (this.num >= 0n && other.num < 0n) return 1;
    return this.cmp(other);
  };

  BN.red = function red(num) {
    return new Red(num);
  };

  BN.prototype.toRed = function toRed(ctx) {
    assert(!this.red, "Already a number in reduction context");
    assert(this.negative === 0, "red works only with positives");
    return ctx.convertTo(this)._forceRed(ctx);
  };

  BN.prototype.fromRed = function fromRed() {
    assert(this.red, "fromRed works only with numbers in reduction context");
    return this.red.convertFrom(this);
  };

  BN.prototype._forceRed = function _forceRed(ctx) {
    this.red = ctx;
    return this;
  };

  BN.prototype.forceRed = function forceRed(ctx) {
    assert(!this.red, "Already a number in reduction context");
    return this._forceRed(ctx);
  };

  BN.prototype.redAdd = function redAdd(num) {
    assert(this.red, "redAdd works only with red numbers");
    return this.red.add(this, num);
  };

  BN.prototype.redIAdd = function redIAdd(num) {
    assert(this.red, "redIAdd works only with red numbers");
    return this.red.iadd(this, num);
  };

  BN.prototype.redSub = function redSub(num) {
    assert(this.red, "redSub works only with red numbers");
    return this.red.sub(this, num);
  };

  BN.prototype.redISub = function redISub(num) {
    assert(this.red, "redISub works only with red numbers");
    return this.red.isub(this, num);
  };

  BN.prototype.redShl = function redShl(num) {
    assert(this.red, "redShl works only with red numbers");
    return this.red.shl(this, num);
  };

  BN.prototype.redMul = function redMul(num) {
    assert(this.red, "redMul works only with red numbers");
    this.red._verify2(this, num);
    return this.red.mul(this, num);
  };

  BN.prototype.redIMul = function redIMul(num) {
    assert(this.red, "redMul works only with red numbers");
    this.red._verify2(this, num);
    return this.red.imul(this, num);
  };

  BN.prototype.redSqr = function redSqr() {
    assert(this.red, "redSqr works only with red numbers");
    this.red._verify1(this);
    return this.red.sqr(this);
  };

  BN.prototype.redISqr = function redISqr() {
    assert(this.red, "redISqr works only with red numbers");
    this.red._verify1(this);
    return this.red.isqr(this);
  };

  // Square root over p
  BN.prototype.redSqrt = function redSqrt() {
    assert(this.red, "redSqrt works only with red numbers");
    this.red._verify1(this);
    return this.red.sqrt(this);
  };

  BN.prototype.redInvm = function redInvm() {
    assert(this.red, "redInvm works only with red numbers");
    this.red._verify1(this);
    return this.red.invm(this);
  };

  // Return negative clone of `this` % `red modulo`
  BN.prototype.redNeg = function redNeg() {
    assert(this.red, "redNeg works only with red numbers");
    this.red._verify1(this);
    return this.red.neg(this);
  };

  BN.prototype.redPow = function redPow(num) {
    assert(this.red && !num.red, "redPow(normalNum)");
    this.red._verify1(this);
    return this.red.pow(this, num);
  };

  var primes = {
    k256: null,
    p224: null,
    p192: null,
    p25519: null,
  };

  // Pseudo-Mersenne prime
  function MPrime(name, p) {
    this.name = name;
    this.p = new BN(p, 16);
    this.n = this.p.bitLength();
    this.k = new BN(1).ishln(this.n).isub(this.p);
  }

  MPrime.prototype.ireduce = function (num) {
    let r = num;
    let tmp = new BN(0);
    do {
      this.split(r, tmp);
      r = this.imulK(r);
      r = r.iadd(tmp);
    } while (r.bitLength() > this.n);

    let cmp = new BN(r.bitLength()).cmp(this.n) < 0 ? -1 : r.ucmp(this.p);
    if (cmp === 0) {
      r = new BN(0);
    } else if (cmp > 0) {
      r = r.isub(this.p);
    } // strip related operations are ignored

    return r;
  };

  MPrime.prototype.split = function (num, output) {
    let mask = new BN(1).ishln(this.n).isub(new BN(1));
    let lo = num.iand(mask);
    let hi = num.ishrn(this.n);

    output.num = lo.num;
    num.num = hi.num;
  };

  MPrime.prototype.imulK = function (num) {
    return num.imul(this.k);
  };

  function K256() {
    MPrime.call(
      this,
      "k256",
      "fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"
    );
  }

  // Assumes you have a utility function for inheritance
  inherits(K256, MPrime);

  K256.prototype.split = function split(input, output) {
    // 256 = 9 * 26 + 22
    const mask = 0x3fffffn; // BigInt literal

    if (input.bitLength() <= 9 * 26) {
      output.num = input.num;
      input.num = 0n;
      return;
    }

    // Extract the bottom 9 * 26 bits (lower part)
    let lower = input.num & ((1n << (9n * 26n)) - 1n);
    output.num = lower;

    // Shift by 9 * 26 bits (upper part)
    let upper = input.num >> (9n * 26n);

    // Extract the first 22 bits of the upper part
    let first22Bits = upper & mask;
    output.num |= first22Bits << (9n * 26n);

    upper >>= 22n;

    input.num = upper;
  };

  K256.prototype.imulK = function imulK(num) {
    const MASK = 0x3ffffffn;
    const K = 0x3d1n;

    let w = num.num;
    let lo = w * K;
    let hi = (w << 6n) + (lo >> 26n);

    let result = (hi << 26n) | (lo & MASK);

    return new BN(result);
  };

  function P224() {
    MPrime.call(
      this,
      "p224",
      "ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001"
    );
  }
  inherits(P224, MPrime);

  function P192() {
    MPrime.call(
      this,
      "p192",
      "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff"
    );
  }
  inherits(P192, MPrime);

  function P25519() {
    // 2 ^ 255 - 19
    MPrime.call(
      this,
      "25519",
      "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed"
    );
  }
  inherits(P25519, MPrime);

  P25519.prototype.imulK = function imulK(num) {
    // K = 0x13
    let carry = 0n;
    let val = num.num;
    let res = 0n;
    let base = 1n;
    while (val > 0n) {
      let digit = val % 0x4000000n; // Get the last 26 bits
      val /= 0x4000000n; // Shift right by 26 bits

      let hi = digit * 0x13n + carry;
      let lo = hi & 0x3ffffffn; // Masking to get the last 26 bits
      hi >>= 26n; // Equivalent to hi >>>= 26

      res += lo * base;
      base *= 0x4000000n; // Update the base for the next iteration

      carry = hi;
    }

    if (carry !== 0n) {
      res += carry * base;
    }

    num.num = res;
    return num;
  };

  BN._prime = function prime(name) {
    // Cached version of prime
    if (primes[name]) return primes[name];

    var prime;
    if (name === "k256") {
      prime = new K256();
    } else if (name === "p224") {
      prime = new P224();
    } else if (name === "p192") {
      prime = new P192();
    } else if (name === "p25519") {
      prime = new P25519();
    } else {
      throw new Error("Unknown prime " + name);
    }
    primes[name] = prime;

    return prime;
  };

  function Red(m) {
    if (typeof m === "string") {
      var prime = BN._prime(m);
      this.m = prime.p;
      this.prime = prime;
    } else {
      assert(m.gtn(1), "modulus must be greater than 1");
      this.m = m;
      this.prime = null;
    }
  }

  Red.prototype._verify1 = function _verify1(a) {
    assert(a.negative === 0, "red works only with positives");
    assert(a.red, "red works only with red numbers");
  };

  Red.prototype._verify2 = function _verify2(a, b) {
    assert((a.negative | b.negative) === 0, "red works only with positives");
    assert(a.red && a.red === b.red, "red works only with red numbers");
  };

  Red.prototype.imod = function imod(a) {
    if (this.prime) return this.prime.ireduce(a)._forceRed(this);
    move(a, a.umod(this.m)._forceRed(this));
    return a;
  };

  Red.prototype.neg = function neg(a) {
    if (a.isZero()) {
      return a.clone();
    }

    return this.m.sub(a)._forceRed(this);
  };

  Red.prototype.add = function add(a, b) {
    this._verify2(a, b);

    var res = a.add(b);
    if (res.cmp(this.m) >= 0) {
      res.isub(this.m);
    }
    return res._forceRed(this);
  };

  Red.prototype.iadd = function iadd(a, b) {
    this._verify2(a, b);

    var res = a.iadd(b);
    if (res.cmp(this.m) >= 0) {
      res.isub(this.m);
    }
    return res;
  };

  Red.prototype.sub = function sub(a, b) {
    this._verify2(a, b);

    var res = a.sub(b);
    if (res.cmpn(0) < 0) {
      res.iadd(this.m);
    }
    return res._forceRed(this);
  };

  Red.prototype.isub = function isub(a, b) {
    this._verify2(a, b);

    var res = a.isub(b);
    if (res.cmpn(0) < 0) {
      res.iadd(this.m);
    }
    return res;
  };

  Red.prototype.shl = function shl(a, num) {
    this._verify1(a);
    return this.imod(a.ushln(num));
  };

  Red.prototype.imul = function imul(a, b) {
    this._verify2(a, b);
    return this.imod(a.imul(b));
  };

  Red.prototype.mul = function mul(a, b) {
    this._verify2(a, b);
    return this.imod(a.mul(b));
  };

  Red.prototype.isqr = function isqr(a) {
    return this.imul(a, a.clone());
  };

  Red.prototype.sqr = function sqr(a) {
    return this.mul(a, a);
  };

  Red.prototype.sqrt = function sqrt(a) {
    if (a.isZero()) return a.clone();

    var mod3 = this.m.andln(3);
    assert(mod3 % 2 === 1);

    // Fast case
    if (mod3 === 3) {
      var pow = this.m.add(new BN(1)).iushrn(2);
      return this.pow(a, pow);
    }

    // Tonelli-Shanks algorithm (Totally unoptimized and slow)
    //
    // Find Q and S, that Q * 2 ^ S = (P - 1)
    var q = this.m.subn(1);
    var s = 0;
    while (!q.isZero() && q.andln(1) === 0) {
      s++;
      q.iushrn(1);
    }
    assert(!q.isZero());

    var one = new BN(1).toRed(this);
    var nOne = one.redNeg();

    // Find quadratic non-residue
    // NOTE: Max is such because of generalized Riemann hypothesis.
    var lpow = this.m.subn(1).iushrn(1);
    var z = this.m.bitLength();
    z = new BN(2 * z * z).toRed(this);

    while (this.pow(z, lpow).cmp(nOne) !== 0) {
      z.redIAdd(nOne);
    }

    var c = this.pow(z, q);
    var r = this.pow(a, q.addn(1).iushrn(1));
    var t = this.pow(a, q);
    var m = s;
    while (t.cmp(one) !== 0) {
      var tmp = t;
      for (var i = 0; tmp.cmp(one) !== 0; i++) {
        tmp = tmp.redSqr();
      }
      assert(i < m);
      var b = this.pow(c, new BN(1).iushln(m - i - 1));

      r = r.redMul(b);
      c = b.redSqr();
      t = t.redMul(c);
      m = i;
    }

    return r;
  };

  Red.prototype.pow = function pow(a, num) {
    if (num.isZero()) return new BN(1).toRed(this);

    if (num.cmpn(1) === 0) return a.clone();

    var windowSize = 4;
    var wnd = new Array(1 << windowSize);
    wnd[0] = new BN(1).toRed(this);
    wnd[1] = a;
    for (let i = 2; i < wnd.length; i++) {
      wnd[i] = this.mul(wnd[i - 1], a);
    }

    let res = wnd[0];
    let current = 0n;
    let currentLen = 0;
    let numBinary = num.toString(2);

    for (let i = 0; i < numBinary.length; i++) {
      let bit = BigInt(numBinary[i]);

      if (!res.eq(wnd[0])) {
        res = this.sqr(res);
      }

      if (bit === 0n && current === 0n) {
        currentLen = 0;
        continue;
      }

      current <<= 1n;
      current |= bit;
      currentLen++;
      if (currentLen !== windowSize && i !== numBinary.length - 1) continue;

      res = this.mul(res, wnd[Number(current)]);
      currentLen = 0;
      current = 0n;
    }

    return res;
  };

  Red.prototype.invm = function invm(a) {
    var inv = a._invmp(this.m);
    if (inv.negative !== 0) {
      return this.imod(inv).redNeg();
    } else {
      return this.imod(inv);
    }
  };
  Red.prototype.convertTo = function convertTo(num) {
    var r = num.umod(this.m);
    return r === num ? r.clone() : r;
  };

  Red.prototype.convertFrom = function convertFrom(num) {
    var res = num.clone();
    res.red = null;
    return res;
  };

  //
  // Montgomery method engine
  //

  BN.mont = function mont(num) {
    return new Mont(num);
  };

  function Mont(m) {
    Red.call(this, m);

    this.shift = this.m.bitLength();
    if (this.shift % 26 !== 0) {
      this.shift += 26 - (this.shift % 26);
    }

    this.r = new BN(1).iushln(this.shift);
    this.r2 = this.imod(this.r.sqr());
    this.rinv = this.r._invmp(this.m);

    this.minv = this.rinv.mul(this.r).isubn(1).div(this.m);
    this.minv = this.minv.umod(this.r);
    this.minv = this.r.sub(this.minv);
  }
  inherits(Mont, Red);

  Mont.prototype.convertTo = function convertTo(num) {
    return this.imod(num.ushln(this.shift));
  };

  Mont.prototype.convertFrom = function convertFrom(num) {
    var r = this.imod(num.mul(this.rinv));
    r.red = null;
    return r;
  };

  Mont.prototype.imul = function imul(a, b) {
    if (a.isZero() || b.isZero()) {
      return a;
    }

    var t = a.imul(b);
    var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
    var u = t.isub(c).iushrn(this.shift);
    var res = u;

    if (u.cmp(this.m) >= 0) {
      res = u.isub(this.m);
    } else if (u.cmpn(0) < 0) {
      res = u.iadd(this.m);
    }

    return res._forceRed(this);
  };

  Mont.prototype.mul = function mul(a, b) {
    if (a.isZero() || b.isZero()) return new BN(0)._forceRed(this);

    var t = a.mul(b);
    var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
    var u = t.isub(c).iushrn(this.shift);
    var res = u;
    if (u.cmp(this.m) >= 0) {
      res = u.isub(this.m);
    } else if (u.cmpn(0) < 0) {
      res = u.iadd(this.m);
    }

    return res._forceRed(this);
  };

  Mont.prototype.invm = function invm(a) {
    // (AR)^-1 * R^2 = (A^-1 * R^-1) * R^2 = A^-1 * R
    var res = this.imod(a._invmp(this.m).mul(this.r2));
    return res._forceRed(this);
  };
})(typeof module === "undefined" || module, this);
