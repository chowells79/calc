class Calculator {
    static #trailingCharacters = /^(.+?)\.?0*$/;
    static #resultMaxMagnitude = 9999999999;
    static #tenDigitMinMagnitude = 1000000000;

    // This is a mess, but it's the best I can come up with that:
    //   1. Doesn't sometimes switch to scientific notation
    //   2. Shows no more than 10 digits, regardless of the presence of - and .
    //   3. Puts a zero ahead of a decimal point for |input| < 1
    //   4. Doesn't introduce exessive rounding errors
    //   5. Doesn't produce egregiously incorrect output
    //   6. Doesn't show a trailing decimal point
    //   7. Doesn't show trailing zeroes after the decimal point
    static render(num) {
        if (typeof num !== "number") {
            throw "render: input was not a number";
        }

        if (!Number.isFinite(num) || Number.isNaN(num)) {
            return "Undefined";
        }

        if (Math.abs(num) > this.#resultMaxMagnitude) {
            return "Error";
        }

        // work with only non-negative numbers for intermediate calculations
        const negative = num < 0;
        num = Math.abs(num)

        // scale rounding to the correct digit
        let dotPos = 10;
        while (num > 0 && num < this.#tenDigitMinMagnitude && dotPos > 1) {
            num *= 10;
            dotPos--;
        }

        num = Math.round(num);

        // insert leading zeroes for numbers < 1
        let raw = num.toString();
        while (num > 0 && num < this.#tenDigitMinMagnitude) {
            num *= 10;
            raw = "0" + raw;
        }
        raw = raw.substring(0, 10);

        // insert the decimal point, insert the negative sign if needed,
        // and strip trailing optional characters
        let result = raw.substring(0, dotPos) + "." + raw.substring(dotPos);
        if (negative) result = "-" + result;
        return result.match(this.#trailingCharacters)[1];
    }


    #highPrec; // pending high-precedence operation
    #lowPrec; // pending low-precedence operation
    #digits; // digits entered so far
    #sigNum; // sign of number entered so far
    #wholeDigitCount; // mark where the decimal point is

    // This is a temporary override for the current number when no input
    // has been provided yet. It's a bit uncomfortable of a solution, and
    // I'd much rather use an ADT to indicate what mode it's in, but that's
    // a lot of work in javascript. So I'm leaving it at merely "working"
    // for now.
    #tempNum;

    constructor() {
        this.resetAll();
    }

    // Overall, this class implements a kind of state machine for the user.
    // Public methods are events that the state machine can process. Each
    // public method returns a string containing the current value to display.

    resetAll() {
        this.#highPrec = null;
        this.#lowPrec = null;
        return this.resetCurrent();
    }

    resetCurrent() {
        this.#digits = "0";
        this.#sigNum = 1;
        this.#wholeDigitCount = -1;
        this.#tempNum = null;
        return "0"
    }

    #echoResponse() {
        let str;
        if (this.#wholeDigitCount < 0) {
            str = this.#digits;
        } else {
             str = this.#digits.substring(0, this.#wholeDigitCount) + "." +
                this.#digits.substring(this.#wholeDigitCount);
        }

        if (this.#sigNum < 0) {
            str = '-' + str;
        }
        return str;
    }

    addDigit(s) {
        this.#tempNum = null;

        // if this is the first input, don't preserve 0
        if (this.#digits === "0" && this.#wholeDigitCount < 0) {
            this.#digits = s;
        } else {
            const raw = this.#digits + s;
            this.#digits = raw.substring(0, 10);
        }
        return this.#echoResponse();
    }

    negate() {
        if (this.#tempNum !== null) {
            this.#tempNum *= -1
            return Calculator.render(this.#tempNum);
        } else {
            this.#sigNum *= -1;
            return this.#echoResponse();
        }
    }

    placeDecimal() {
        this.#tempNum = null;

        if (this.#wholeDigitCount < 0) {
            this.#wholeDigitCount = this.#digits.length
        } else {
            // I think the best behavior is to just ignore
            // the input in this case
        }
        return this.#echoResponse();
    }

    #currentNum() {
        if (this.#tempNum !== null) return this.#tempNum;

        return Number.parseFloat(this.#echoResponse());
    }

    highPrecOp(f) {
        let num = this.#currentNum();
        if (this.#highPrec !== null) num = this.#highPrec(num);

        this.#highPrec = (arg) => f(num, arg);
        this.resetCurrent();
        this.#tempNum = num;
        return Calculator.render(num);
    }

    lowPrecOp(f) {
        let num = this.#currentNum();

        if (this.#highPrec !== null) num = this.#highPrec(num);
        this.#highPrec = null;

        if (this.#lowPrec !== null) num = this.#lowPrec(num);
        this.#lowPrec = (arg) => f(num, arg);

        this.resetCurrent();
        this.#tempNum = num;
        return Calculator.render(num);
    }

    solve() {
        let resp = this.#currentNum();
        if (this.#highPrec !== null) resp = this.#highPrec(resp);
        if (this.#lowPrec !== null) resp = this.#lowPrec(resp);

        this.resetAll();
        this.#tempNum = resp;
        return Calculator.render(resp);
    }
}


window.addEventListener("load", (_ev) => {
    const calc = new Calculator();

    const keybinds = [
        ["period", () => calc.placeDecimal() ],
        ["plusminus", () => calc.negate() ],
        ["ac", () => calc.resetAll() ],
        ["c", () => calc.resetCurrent() ],
        ["divide", () => calc.highPrecOp((x, y) => x / y) ],
        ["multiply", () => calc.highPrecOp((x, y) => x * y) ],
        ["subtract", () => calc.lowPrecOp((x, y) => x - y) ],
        ["addition", () => calc.lowPrecOp((x, y) => x + y) ],
        ["equals", () => calc.solve() ]
    ];

    // add the number key bindings
    for (let i = 0; i < 10; i++) {
        keybinds.push(["k" + i, () => calc.addDigit(i.toString()) ]);
    }

    // bind the screen to a local name
    const out = document.getElementById("display");

    // apply the key bindings
    for (const [id, fun] of keybinds) {
        const el = document.getElementById(id);
        el.addEventListener("click", (_click) => { out.value = fun(); })
    }

    // make the active calculator available for debugging
    // window.calc = calc;
});
