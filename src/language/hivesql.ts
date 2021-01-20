import Formatter from '../core/Formatter';
import Tokenizer from '../core/Tokenizer';
import tokenTypes from '../core/tokenTypes';

const reservedWords = [
  'add',
  'between',
  'table'
];

const reservedTopLevelWords = [
  'and',
  'add',
  'on',
  'lateral view',
  'alter column',
  'alter table',
  'end',
  'from',
  'group by',
  'having',
  'insert overwrite',
  'insert into',
  'insert',
  'limit',
  'order by',
  'select',
  'set',
  'where',
  'create',
  'create external'
];

const reservedTopLevelWordsNoIndent = ['INTERSECT', 'INTERSECT ALL', 'MINUS', 'UNION', 'UNION ALL'];

const reservedNewlineWords = [
  'inner join',
  'join',
  'left join',
  'left outer join',
  'or',
  'outer join',
  'right join',
  'right outer join',
  'lateral view',
  'explode',
  'end',
  'else',
  'when'
];

const tokenOverride = (token, previousReservedToken) => {
  if (
    token.type === tokenTypes.reserved_top_level &&
    token.value === 'set' &&
    previousReservedToken.value === 'by'
  ) {
    token.type = tokenTypes.reserved;
    return token;
  }
};

let tokenizer;

export default class HQLFormatter {
    cfg;
  /**
   * @param {Object} cfg Different set of configurations
   */
  constructor(cfg) {
    this.cfg = cfg;
  }

  /**
   * Format the whitespace in a HQL string to make it easier to read
   *
   * @param {String} query The HQL string
   * @return {String} formatted string
   */
  format(query) {
    if (!tokenizer) {
      tokenizer = new Tokenizer({
        reservedWords,
        reservedTopLevelWords,
        reservedNewlineWords,
        reservedTopLevelWordsNoIndent,
        stringTypes: [`""`, "''", '``'],
        // stringTypes: [`""`, "n''", "''", '``'],
        openParens: ['(', 'case'],
        closeParens: [')', 'end'],
        indexedPlaceholderTypes: ['?'],
        namedPlaceholderTypes: [':'],
        lineCommentTypes: ['--'],
        specialWordChars: ['_', '$', '#', '.', '@'],
        reservedNoNewLineWords:['if','over','coalesce','from_unixtime','lead','lag','date_format','date_add']
      });
    }
    return new Formatter(this.cfg, tokenizer, tokenOverride).format(query);
  }
}
