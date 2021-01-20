// import includes from 'lodash/includes';
import {includes} from 'lodash/index';
import tokenTypes from './tokenTypes';

import Indentation from './Indentation';
import InlineBlock from './InlineBlock';
import Params from './Params';

const trimSpacesEnd = str => str.replace(/[ \t]+$/u, '');

export default class Formatter {
  /**
   * @param {Object} cfg
   *  @param {String} cfg.language
   *  @param {String} cfg.indent
   *  @param {Bool} cfg.uppercase
   *  @param {Integer} cfg.linesBetweenQueries
   *  @param {Object} cfg.params
   * @param {Tokenizer} tokenizer
   */
  cfg;
  indentation;
  inlineBlock;
  params;
  tokenizer;
  tokenOverride;
  previousReservedWord;
  tokens;
  index;
  constructor(cfg, tokenizer, tokenOverride) {
    this.cfg = cfg || {};
    this.indentation = new Indentation(this.cfg.indent);
    this.inlineBlock = new InlineBlock();
    this.params = new Params(this.cfg.params);
    this.tokenizer = tokenizer;
    this.tokenOverride = tokenOverride;
    this.previousReservedWord = {};
    this.tokens = [];
    this.index = 0;
  }

  /**
   * Formats whitespace in a SQL string to make it easier to read.
   *
   * @param {String} query The SQL query string
   * @return {String} formatted query
   */
  format(query) {
    this.tokens = this.tokenizer.tokenize(query);
    const formattedQuery = this.getFormattedQueryFromTokens();

    return formattedQuery.trim();
  }

  getFormattedQueryFromTokens() {
    let formattedQuery = '';
    //增加
    let lastType = '';
    let noNewLineFlag = false;
    let noNewLineBlock = [];
    let whenCnt = 0;
    this.tokens.forEach((token, index) => {
      this.index = index;
      if (token.type != tokenTypes.word && token.type != tokenTypes.string && token.type != tokenTypes.line_comment
        && token.type != tokenTypes.block_comment) {
        token.value = token.value.toLowerCase()
      }
      
      // 后续内容不换行单词记录
      if (lastType == tokenTypes.reserved_no_new_line_words) {
        noNewLineFlag = true;
      }
      // top-level后不换行
      if (token.type != tokenTypes.whitespace) {
        lastType = token.type
      };
      // 第一个when不换行
      if (token.value.toLowerCase() == 'when' || whenCnt == 1) {
        whenCnt++;
      } else if(token.value.toLowerCase() == 'end' || token.value.toLowerCase() == 'else') {
        whenCnt = 0
      };

      if (this.tokenOverride) token = this.tokenOverride(token, this.previousReservedWord) || token;

      if (token.type === tokenTypes.whitespace) {
        // ignore (we do our own whitespace formatting)
      } else if (token.type === tokenTypes.line_comment) {
        formattedQuery = this.formatLineComment(token, formattedQuery);
      } else if (token.type === tokenTypes.block_comment) {
        formattedQuery = this.formatBlockComment(token, formattedQuery);
      } else if (token.type === tokenTypes.reserved_top_level) {
        if (noNewLineFlag) {
          formattedQuery += token.value
        } else {
          let arrayToken = token.value.split(' ')
          if (arrayToken.length > 1) {
            token.value = arrayToken[0].padStart(6,' ') + '  ' + arrayToken.slice(1,).join("")+'  '
          }
          else {
            token.value = arrayToken[0].padStart(6,' ') + '  '
          }
          formattedQuery = this.formatTopLevelReservedWord(token, formattedQuery);
          this.previousReservedWord = token;
        }
      } else if (token.type === tokenTypes.reserved_top_level_no_indent) {
        formattedQuery = this.formatTopLevelReservedWordNoIndent(token, formattedQuery);
        this.previousReservedWord = token;
      } else if (token.type === tokenTypes.reserved_newline) {
        if (token.value != 'end' && token.value != 'else' && token.value != 'when') {
          let arrayToken = token.value.split(' ')
          token.value = arrayToken[0].padStart(6,' ') + '  '
          if (arrayToken.length > 1) {
            token.value += arrayToken.slice(1,).join("")+'  '
          }
        }

        if (noNewLineFlag) {
          formattedQuery += token.value;
        } else if (whenCnt == 1) {
          formattedQuery += ' '+token.value+' ';
        } else {
          formattedQuery = this.formatNewlineReservedWord(token, formattedQuery);
        }
        this.previousReservedWord = token;
      } else if (token.type === tokenTypes.reserved) {
        formattedQuery = this.formatWithSpaces(token, formattedQuery);
        this.previousReservedWord = token;
      } else if (token.type === tokenTypes.open_paren) {
        if (noNewLineFlag) {
          noNewLineBlock.push('a')
          formattedQuery = formattedQuery + token.value.replace('\n,','\n       '+this.indentation.getBlockIndent()+',')
        } else {
          formattedQuery = this.formatOpeningParentheses(token, formattedQuery);
        }
      } else if (token.type === tokenTypes.close_paren) {
        if (noNewLineBlock.length > 0) {
          formattedQuery += token.value
        } else {
          formattedQuery = this.formatClosingParentheses(token, formattedQuery);
        };
        if (noNewLineFlag){
          noNewLineBlock.pop()
        };
        if (noNewLineBlock.length == 0){
          noNewLineFlag = false
        }

      } else if (token.type === tokenTypes.placeholder) {
        formattedQuery = this.formatPlaceholder(token, formattedQuery);
      } else if (token.value === ',') {
        formattedQuery = this.formatComma(token, formattedQuery);
      } else if (token.value === ':') {
        formattedQuery = this.formatWithSpaceAfter(token, formattedQuery);
      } else if (token.value === '.') {
        formattedQuery = this.formatWithoutSpaces(token, formattedQuery);
      } else if (token.value === ';') {
        formattedQuery = this.formatQuerySeparator(token, formattedQuery);
      } else {
        // top关键字之后数据,与不换行单词之后
        if (lastType == tokenTypes.reserved_top_level || noNewLineFlag){
          token.value = token.value.replace('\n','')
        } else {
          token.value = token.value.replace('\n','\n       '+this.indentation.getBlockIndent())
        }
        formattedQuery = this.formatWithSpaces(token, formattedQuery);
      }
    });
    return formattedQuery;
  }

  formatLineComment(token, query) {
    // query = trimSpacesEnd(query);
    return query + token.value.replace('\n','');
    // return this.addNewline(query + token.value);
  }

  formatBlockComment(token, query) {
    query = trimSpacesEnd(query);
    return query + '  '+ token.value+'\n';
    return this.addNewline(this.addNewline(query) + this.indentComment(token.value));
  }

  indentComment(comment) {
    return comment.replace(/\n[ \t]*/gu, '\n' + this.indentation.getIndent() + ' ');
  }

  formatTopLevelReservedWordNoIndent(token, query) {
    this.indentation.decreaseTopLevel();
    query = this.addNewline(query) + this.equalizeWhitespace(this.formatReservedWord(token.value));
    return this.addNewline(query);
  }

  formatTopLevelReservedWord(token, query) {
    this.indentation.decreaseTopLevel();

    if (this.indentation.blockTypes.length > 0) {
      query = this.addBlockNewline(query);
    } else {
      query = this.addNewline(query);
    }

    this.indentation.increaseTopLevel();

    // 修改
    // query += this.equalizeWhitespace(this.formatReservedWord(token.value));
    query += this.formatReservedWord(token.value);
    return query;
    // return this.addNewline(query);
  }

  formatNewlineReservedWord(token, query) {
    if (this.indentation.blockTypes.length > 0) {
      query = this.addBlockNewline(query)
    } else{
      query = this.addNewline(query) 
    };
    if (token.value.toLowerCase() == 'when' || token.value.toLowerCase() == 'else') {
      query += '    '
    }
    return query+  this.formatReservedWord(token.value) + ' '
    // return query+  this.equalizeWhitespace(this.formatReservedWord(token.value)) + ' '
  }

  // Replace any sequence of whitespace characters with single space
  equalizeWhitespace(string) {
    return string.replace(/\s+/gu, ' ');
  }

  // Opening parentheses increase the block indent level and start a new line
  formatOpeningParentheses(token, query) {
    // Take out the preceding space unless there was whitespace there in the original query
    // or another opening parens or line comment
    const preserveWhitespaceFor = [
      tokenTypes.whitespace,
      tokenTypes.open_paren,
      tokenTypes.line_comment
    ];
    if (!includes(preserveWhitespaceFor, this.previousToken().type)) {
      query = trimSpacesEnd(query);
    }
    // 补足缩进
    let caseFlag = token.value
    token.value = token.value.replace('\n,','\n       '+this.indentation.getBlockIndent()+',')
  
    query += this.cfg.uppercase ? token.value.toUpperCase() : token.value.toLowerCase();

    this.inlineBlock.beginIfPossible(this.tokens, this.index);

    if (!this.inlineBlock.isActive()) {
      this.indentation.increaseBlockLevel();
      if (caseFlag.toLowerCase() !== '\n,case' && caseFlag.toLowerCase() !== 'case') {
        query = this.addBlockNewline(query);
      }
    }    
    return query;
  }

  // Closing parentheses decrease the block indent level
  formatClosingParentheses(token, query) {
    token.value = this.cfg.uppercase ? token.value.toUpperCase() : token.value.toLowerCase();
    if (this.inlineBlock.isActive()) {
      this.inlineBlock.end();
      return this.formatWithSpaceAfter(token, query);
    } else {
      query = this.formatWithSpaces(token, this.addBlockNewline(query));
      this.indentation.decreaseBlockLevel();
      return query;
      // if  (this.indentation.blockTypes.length > 0) {
      //   return this.formatWithSpaces(token, this.addBlockNewline(query));
      // } else {
      //   return this.formatWithSpaces(token, this.addNewline(query));
      // }
    }
  }

  formatPlaceholder(token, query) {
    return query + this.params.get(token) + ' ';
  }

  // Commas start a new line (unless within inline parentheses or SQL "LIMIT" clause)
  formatComma(token, query) {
    if (this.inlineBlock.isActive()) {
      return query;
    } else if (/^LIMIT$/iu.test(this.previousReservedWord.value)) {
      return query;
    } else {
      query = this.addNewline(query);
    }
    return trimSpacesEnd(query) + token.value;

  }

  formatWithSpaceAfter(token, query) {
    return trimSpacesEnd(query) + token.value + ' ';
  }

  formatWithoutSpaces(token, query) {
    return trimSpacesEnd(query) + token.value;
  }

  formatWithSpaces(token, query) {
    const value = token.type === 'reserved' ? this.formatReservedWord(token.value) : token.value;
    return query + value + ' ';
  }

  formatReservedWord(value) {
    return this.cfg.uppercase ? value.toUpperCase() : value.toLowerCase();
  }

  formatQuerySeparator(token, query) {
    this.indentation.resetIndentation();
    return trimSpacesEnd(query) + token.value + '\n'.repeat(this.cfg.linesBetweenQueries || 1);
  }

  addNewline(query) {
    query = trimSpacesEnd(query);
    if (!query.endsWith('\n')) query += '\n';
    return query + this.indentation.getIndent();
  }

  addBlockNewline(query) {
    query = trimSpacesEnd(query);
    if (!query.endsWith('\n')) query += '\n';
    return query + this.indentation.getBlockIndent();
  }

  previousToken(offset = 1) {
    return this.tokens[this.index - offset] || {};
  }
}
