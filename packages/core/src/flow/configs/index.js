"use strict";
/**
 * Pipeline configs barrel export.
 * Re-exports ALL 13 pipeline configs (Builder 01's NBX + Builder 02's Sales/Prospect/Reactive).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_PIPELINE_CONFIGS = exports.REACTIVE_MEDICARE_CONFIG = exports.REACTIVE_RETIREMENT_CONFIG = exports.PROSPECT_LEGACY_CONFIG = exports.PROSPECT_MEDICARE_CONFIG = exports.PROSPECT_RETIREMENT_CONFIG = exports.SALES_LEGACY_CONFIG = exports.SALES_MEDICARE_CONFIG = exports.SALES_RETIREMENT_CONFIG = exports.NBX_MEDICARE_MAPD_CONFIG = exports.NBX_MEDICARE_MEDSUP_CONFIG = exports.NBX_ANNUITY_CONFIG = exports.NBX_LIFE_CONFIG = exports.NBX_SECURITIES_CONFIG = void 0;
// NBX pipelines (Builder 01)
var nbx_securities_1 = require("./nbx-securities");
Object.defineProperty(exports, "NBX_SECURITIES_CONFIG", { enumerable: true, get: function () { return nbx_securities_1.NBX_SECURITIES_CONFIG; } });
var nbx_life_1 = require("./nbx-life");
Object.defineProperty(exports, "NBX_LIFE_CONFIG", { enumerable: true, get: function () { return nbx_life_1.NBX_LIFE_CONFIG; } });
var nbx_annuity_1 = require("./nbx-annuity");
Object.defineProperty(exports, "NBX_ANNUITY_CONFIG", { enumerable: true, get: function () { return nbx_annuity_1.NBX_ANNUITY_CONFIG; } });
var nbx_medicare_medsup_1 = require("./nbx-medicare-medsup");
Object.defineProperty(exports, "NBX_MEDICARE_MEDSUP_CONFIG", { enumerable: true, get: function () { return nbx_medicare_medsup_1.NBX_MEDICARE_MEDSUP_CONFIG; } });
var nbx_medicare_mapd_1 = require("./nbx-medicare-mapd");
Object.defineProperty(exports, "NBX_MEDICARE_MAPD_CONFIG", { enumerable: true, get: function () { return nbx_medicare_mapd_1.NBX_MEDICARE_MAPD_CONFIG; } });
// Sales pipelines (Builder 02)
var sales_retirement_1 = require("./sales-retirement");
Object.defineProperty(exports, "SALES_RETIREMENT_CONFIG", { enumerable: true, get: function () { return sales_retirement_1.SALES_RETIREMENT_CONFIG; } });
var sales_medicare_1 = require("./sales-medicare");
Object.defineProperty(exports, "SALES_MEDICARE_CONFIG", { enumerable: true, get: function () { return sales_medicare_1.SALES_MEDICARE_CONFIG; } });
var sales_legacy_1 = require("./sales-legacy");
Object.defineProperty(exports, "SALES_LEGACY_CONFIG", { enumerable: true, get: function () { return sales_legacy_1.SALES_LEGACY_CONFIG; } });
// Prospecting pipelines (Builder 02)
var prospect_retirement_1 = require("./prospect-retirement");
Object.defineProperty(exports, "PROSPECT_RETIREMENT_CONFIG", { enumerable: true, get: function () { return prospect_retirement_1.PROSPECT_RETIREMENT_CONFIG; } });
var prospect_medicare_1 = require("./prospect-medicare");
Object.defineProperty(exports, "PROSPECT_MEDICARE_CONFIG", { enumerable: true, get: function () { return prospect_medicare_1.PROSPECT_MEDICARE_CONFIG; } });
var prospect_legacy_1 = require("./prospect-legacy");
Object.defineProperty(exports, "PROSPECT_LEGACY_CONFIG", { enumerable: true, get: function () { return prospect_legacy_1.PROSPECT_LEGACY_CONFIG; } });
// Reactive pipelines (Builder 02)
var reactive_retirement_1 = require("./reactive-retirement");
Object.defineProperty(exports, "REACTIVE_RETIREMENT_CONFIG", { enumerable: true, get: function () { return reactive_retirement_1.REACTIVE_RETIREMENT_CONFIG; } });
var reactive_medicare_1 = require("./reactive-medicare");
Object.defineProperty(exports, "REACTIVE_MEDICARE_CONFIG", { enumerable: true, get: function () { return reactive_medicare_1.REACTIVE_MEDICARE_CONFIG; } });
// Convenience lookup — all 13 configs by pipeline key
const nbx_securities_2 = require("./nbx-securities");
const nbx_life_2 = require("./nbx-life");
const nbx_annuity_2 = require("./nbx-annuity");
const nbx_medicare_medsup_2 = require("./nbx-medicare-medsup");
const nbx_medicare_mapd_2 = require("./nbx-medicare-mapd");
const sales_retirement_2 = require("./sales-retirement");
const sales_medicare_2 = require("./sales-medicare");
const sales_legacy_2 = require("./sales-legacy");
const prospect_retirement_2 = require("./prospect-retirement");
const prospect_medicare_2 = require("./prospect-medicare");
const prospect_legacy_2 = require("./prospect-legacy");
const reactive_retirement_2 = require("./reactive-retirement");
const reactive_medicare_2 = require("./reactive-medicare");
exports.ALL_PIPELINE_CONFIGS = {
    NBX_SECURITIES: nbx_securities_2.NBX_SECURITIES_CONFIG,
    NBX_LIFE: nbx_life_2.NBX_LIFE_CONFIG,
    NBX_ANNUITY: nbx_annuity_2.NBX_ANNUITY_CONFIG,
    NBX_MEDICARE_MEDSUP: nbx_medicare_medsup_2.NBX_MEDICARE_MEDSUP_CONFIG,
    NBX_MEDICARE_MAPD: nbx_medicare_mapd_2.NBX_MEDICARE_MAPD_CONFIG,
    SALES_RETIREMENT: sales_retirement_2.SALES_RETIREMENT_CONFIG,
    SALES_MEDICARE: sales_medicare_2.SALES_MEDICARE_CONFIG,
    SALES_LEGACY: sales_legacy_2.SALES_LEGACY_CONFIG,
    PROSPECT_RETIREMENT: prospect_retirement_2.PROSPECT_RETIREMENT_CONFIG,
    PROSPECT_MEDICARE: prospect_medicare_2.PROSPECT_MEDICARE_CONFIG,
    PROSPECT_LEGACY: prospect_legacy_2.PROSPECT_LEGACY_CONFIG,
    REACTIVE_RETIREMENT: reactive_retirement_2.REACTIVE_RETIREMENT_CONFIG,
    REACTIVE_MEDICARE: reactive_medicare_2.REACTIVE_MEDICARE_CONFIG,
};
