import { registerFormat, create, defaultLanguage, setDefaultLanguage } from './base';
import { open, openSync } from './fs';
import TTFFont from './TTFFont';
import WOFFFont from './WOFFFont';
import TrueTypeCollection from './TrueTypeCollection';
import DFont from './DFont';

// Register font formats
registerFormat(TTFFont);
registerFormat(WOFFFont);
registerFormat(TrueTypeCollection);
registerFormat(DFont);

export * from './base';
export * from './fs';
