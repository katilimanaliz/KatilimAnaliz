"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ancillary = exports.failure = exports.success = exports.input = exports.weak = exports.strong = void 0;
const kleur_1 = __importDefault(require("kleur"));
exports.strong = kleur_1.default.bold;
exports.weak = kleur_1.default.dim;
exports.input = kleur_1.default.cyan;
exports.success = kleur_1.default.green;
exports.failure = kleur_1.default.red;
exports.ancillary = kleur_1.default.cyan;
const COLORS = {
    strong: exports.strong,
    weak: exports.weak,
    input: exports.input,
    success: exports.success,
    failure: exports.failure,
    ancillary: exports.ancillary,
    log: {
        DEBUG: kleur_1.default.magenta,
        INFO: kleur_1.default.cyan,
        WARN: kleur_1.default.yellow,
        ERROR: kleur_1.default.red,
    },
};
exports.default = COLORS;
//# sourceMappingURL=colors.js.map