// import { isEmpty } from "lodash/index";
import tokenTypes from './tokenTypes';
// import escapeRegExp from 'lodash/escapeRegExp';
import { escapeRegExp,isEmpty } from "lodash/index";

export default class Tokenizer {
 /**
   * @param {Object} cfg
   *  @param {String[]} cfg.reservedWords Reserved words in SQL
   *  @param {String[]} cfg.reservedTopLevelWords Words that are set to new line separately
   *  @param {String[]} cfg.reservedNewlineWords Words that are set to newline
   *  @param {String[]} cfg.reservedTopLevelWordsNoIndent Words that are top level but have no indentation
   *  @param {String[]} cfg.stringTypes String types to enable: "", '', ``, [], N''
   *  @param {String[]} cfg.openParens Opening parentheses to enable, like (, [
   *  @param {String[]} cfg.closeParens Closing parentheses to enable, like ), ]
   *  @param {String[]} cfg.indexedPlaceholderTypes Prefixes for indexed placeholders, like ?
   *  @param {String[]} cfg.namedPlaceholderTypes Prefixes for named placeholders, like @ and :
   *  @param {String[]} cfg.lineCommentTypes Line comments to enable, like # and --
   *  @param {String[]} cfg.specialWordChars Special chars that can be found inside of words, like @ and #
   */

    whitespace_regex;
    number_regex;
    operator_regex;
    block_comment_regex;
    line_comment_regex;
    reserved_top_level_regex;
    reserved_top_level_no_indent_regex;
    reserved_newline_regex;
    reserved_plain_regex;
    word_regex;
    string_regex;
    open_paren_regex;
    close_paren_regex;
    indexed_placeholder_regex;
    ident_named_placeholder_regex;
    string_named_placeholder_regex;
    reserved_no_new_line_words_regex;

  constructor(cfg) {
    this.whitespace_regex = /^(\s+)/u;
    this.number_regex = /^((-\s*)?[0-9]+(\.[0-9]+)?|0x[0-9a-fA-F]+|0b[01]+)\b/u;
    this.operator_regex = /^(!=|<>|==|<=|>=|!<|!>|\|\||::|->>|->|~~\*|~~|!~~\*|!~~|~\*|!~\*|!~|:=|.)/u;

    this.block_comment_regex = /^(\/\*[^]*?(?:\*\/|$))/u;
    this.line_comment_regex = this.createLineCommentRegex(cfg.lineCommentTypes);

    this.reserved_top_level_regex = this.createReservedWordRegex(cfg.reservedTopLevelWords);
    this.reserved_top_level_no_indent_regex = this.createReservedWordRegex(
      cfg.reservedTopLevelWordsNoIndent
    );
    this.reserved_newline_regex = this.createReservedWordRegex(cfg.reservedNewlineWords);
    this.reserved_plain_regex = this.createReservedWordRegex(cfg.reservedWords);

    this.word_regex = this.createWordRegex(cfg.specialWordChars);
    this.string_regex = this.createStringRegex(cfg.stringTypes);

    this.open_paren_regex = this.createParenRegex(cfg.openParens);
    this.close_paren_regex = this.createParenRegex(cfg.closeParens);

    this.indexed_placeholder_regex = this.createPlaceholderRegex(
      cfg.indexedPlaceholderTypes,
      '[0-9]*'
    );
    this.ident_named_placeholder_regex = this.createPlaceholderRegex(
      cfg.namedPlaceholderTypes,
      '[a-zA-Z0-9._$]+'
    );
    this.string_named_placeholder_regex = this.createPlaceholderRegex(
      cfg.namedPlaceholderTypes,
      this.createStringPattern(cfg.stringTypes)
    );
    this.reserved_no_new_line_words_regex = this.createNoNewLineWordsRegex(
      cfg.reservedNoNewLineWords
    )
  }

  createNoNewLineWordsRegex(reservedNoNewLineWords) {
    const reservedNoNewLineWordsPattern = reservedNoNewLineWords.join('|').replace(/ /gu, '\\s+');
    return new RegExp(`^(${reservedNoNewLineWordsPattern})\\b`, 'iu');
  }

  createLineCommentRegex(lineCommentTypes) {
    return new RegExp(
      `^((?:${lineCommentTypes.map(c => escapeRegExp(c)).join('|')}).*?(?:\r\n|\r|\n|$))`,
      'u'
    );
  }

  createReservedWordRegex(reservedWords) {
    const reservedWordsPattern = reservedWords.join('|').replace(/ /gu, '\\s+');
    return new RegExp(`^(${reservedWordsPattern})\\b`, 'iu');
  }

  createWordRegex(specialChars = []) {
    return new RegExp(
      `^([\\p{Alphabetic}\\p{Mark}\\p{Decimal_Number}\\p{Connector_Punctuation}\\p{Join_Control}${specialChars.join(
        ''
      )}]+)`,
      'u'
    );
  }

  createStringRegex(stringTypes) {
    return new RegExp('^(' + this.createStringPattern(stringTypes) + ')', 'u');
  }

  // This enables the following string patterns:
  // 1. backtick quoted string using `` to escape
  // 2. square bracket quoted string (SQL Server) using ]] to escape
  // 3. double quoted string using "" or \" to escape
  // 4. single quoted string using '' or \' to escape
  // 5. national character quoted string using N'' or N\' to escape
  createStringPattern(stringTypes) {
    const patterns = {
      '``': '((`[^`]*($|`))+)',
      // '[]': '((\\[[^\\]]*($|\\]))(\\][^\\]]*($|\\]))*)',
      '""': '(("[^"\\\\]*(?:\\\\.[^"\\\\]*)*("|$))+)',
      "''": "(('[^'\\\\]*(?:\\\\.[^'\\\\]*)*('|$))+)"
      // "N''": "((N'[^N'\\\\]*(?:\\\\.[^N'\\\\]*)*('|$))+)"
    };

    return stringTypes.map(t => patterns[t]).join('|');
  }

  createParenRegex(parens) {
    return new RegExp('^(' + parens.map(p => this.escapeParen(p)).join('|') + ')', 'iu');
  }

  escapeParen(paren) {
    if (paren.length === 1) {
      // A single punctuation character
      return escapeRegExp(paren);
    } else {
      // longer word
      return '\\b' + paren + '\\b';
    }
  }

  createPlaceholderRegex(types, pattern) {
    if (isEmpty(types)) {
      return false;
    }
    const typesRegex = types.map(escapeRegExp).join('|');

    return new RegExp(`^((?:${typesRegex})(?:${pattern}))`, 'u');
  }

  /**
   * Takes a SQL string and breaks it into tokens.
   * Each token is an object with type and value.
   *
   * @param {String} input The SQL string
   * @return {Object[]} tokens An array of tokens.
   *  @return {String} token.type
   *  @return {String} token.value
   */
  tokenize(input) {
    if (!input) return [];

    const tokens = [];
    let token;

    var commaFlag:boolean=false

    // Keep processing the string until it is empty
    while (input.length) {
      // Get the next token and the token type
      token = this.getNextToken(input, token);
      input = input.substring(token.value.length);
      // 逗号前+\n
      if (token.value==','){
        commaFlag=true
      } else {
        if (commaFlag && token.type != tokenTypes.whitespace) {
          // Advance the string
          token.value = '\n,'+token.value;
          commaFlag=false;
        };
        tokens.push(token);
      };

    }
    return tokens;
  }

  getNextToken(input, previousToken) {
    return (
      this.getWhitespaceToken(input) ||
      this.getCommentToken(input) ||
      this.getStringToken(input) ||
      this.getOpenParenToken(input) ||
      this.getCloseParenToken(input) ||
      this.getPlaceholderToken(input) ||
      this.getNumberToken(input) ||
      this.getReservedWordToken(input, previousToken) ||
      this.getReservedNoNewLineWordsToken(input) ||
      this.getWordToken(input) ||
      this.getOperatorToken(input)
    );
  }

  getWhitespaceToken(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.whitespace,
      regex: this.whitespace_regex
    });
  }

  getCommentToken(input) {
    return this.getLineCommentToken(input) || this.getBlockCommentToken(input);
  }

  getLineCommentToken(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.line_comment,
      regex: this.line_comment_regex
    });
  }

  getBlockCommentToken(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.block_comment,
      regex: this.block_comment_regex
    });
  }

  getStringToken(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.string,
      regex: this.string_regex
    });
  }

  getOpenParenToken(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.open_paren,
      regex: this.open_paren_regex
    });
  }

  getCloseParenToken(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.close_paren,
      regex: this.close_paren_regex
    });
  }

  getPlaceholderToken(input) {
    return (
      this.getIdentNamedPlaceholderToken(input) ||
      this.getStringNamedPlaceholderToken(input) ||
      this.getIndexedPlaceholderToken(input)
    );
  }

  getIdentNamedPlaceholderToken(input) {
    return this.getPlaceholderTokenWithKey({
      input,
      regex: this.ident_named_placeholder_regex,
      parseKey: v => v.slice(1)
    });
  }

  getStringNamedPlaceholderToken(input) {
    return this.getPlaceholderTokenWithKey({
      input,
      regex: this.string_named_placeholder_regex,
      parseKey: v => this.getEscapedPlaceholderKey({ key: v.slice(2, -1), quoteChar: v.slice(-1) })
    });
  }

  getIndexedPlaceholderToken(input) {
    return this.getPlaceholderTokenWithKey({
      input,
      regex: this.indexed_placeholder_regex,
      parseKey: v => v.slice(1)
    });
  }

  getPlaceholderTokenWithKey({ input, regex, parseKey }) {
    const token = this.getTokenOnFirstMatch({ input, regex, type: tokenTypes.placeholder });
    if (token) {
      token.type = parseKey(token.value);
    }
    return token;
  }

  getEscapedPlaceholderKey({ key, quoteChar }) {
    return key.replace(new RegExp(escapeRegExp('\\' + quoteChar), 'gu'), quoteChar);
  }

  // Decimal, binary, or hex numbers
  getNumberToken(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.number,
      regex: this.number_regex
    });
  }

  // Punctuation and symbols
  getOperatorToken(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.operator,
      regex: this.operator_regex
    });
  }

  getReservedWordToken(input, previousToken) {
    // A reserved word cannot be preceded by a "."
    // this makes it so in "my_table.from", "from" is not considered a reserved word
    if (previousToken && previousToken.value && previousToken.value === '.') {
      return;
    }
    return (
      this.getTopLevelReservedToken(input) ||
      this.getNewlineReservedToken(input) ||
      this.getTopLevelReservedTokenNoIndent(input) ||
      this.getPlainReservedToken(input)
    );
  }

  getTopLevelReservedToken(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.reserved_top_level,
      regex: this.reserved_top_level_regex
    });
  }

  getNewlineReservedToken(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.reserved_newline,
      regex: this.reserved_newline_regex
    });
  }

  getTopLevelReservedTokenNoIndent(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.reserved_top_level_no_indent,
      regex: this.reserved_top_level_no_indent_regex
    });
  }

  getPlainReservedToken(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.reserved,
      regex: this.reserved_plain_regex
    });
  }

  getWordToken(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.word,
      regex: this.word_regex
    });
  }

  getReservedNoNewLineWordsToken(input) {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.reserved_no_new_line_words,
      regex: this.reserved_no_new_line_words_regex
    });
  }

  getTokenOnFirstMatch({ input, type, regex }) {
    const matches = input.match(regex);

    if (matches) {
      return { type, value: matches[1] };
    }
  }

}