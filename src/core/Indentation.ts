// import repeat from 'lodash/repeat';
// import last from 'lodash/last';
import { last,repeat } from "lodash/index";

const indent_type_top_level = 'top-level';
const indent_type_block_level = 'block-level';

/**
 * Manages indentation levels.
 *
 * There are two types of indentation levels:
 *
 * - BLOCK_LEVEL : increased by open-parenthesis
 * - TOP_LEVEL : increased by RESERVED_TOP_LEVEL words
 */
export default class Indentation {
  /**
   * @param {String} indent Indent value, default is "        " (2 spaces)
   */
  indent;
  indentTypes;
  blockIndent;
  blockTypes;
  
  constructor(indent) {
    this.indent = indent || '  ';
    this.indentTypes = [];
    this.blockIndent = '         ';
    this.blockTypes = [];
  }

  /**
   * Returns current indentation string.
   * @return {String}
   */
  getBlockIndent() {
    return repeat(this.blockIndent, this.blockTypes.length);
  }

  /**
   * Returns current indentation string.
   * @return {String}
   */
  getIndent() {
    return repeat(this.indent, this.indentTypes.length);
  }

  /**
   * Increases indentation by one top-level indent.
   */
  increaseTopLevel() {
    this.indentTypes.push(indent_type_top_level);
  }

  /**
   * Increases indentation by one block-level indent.
   */
  increaseBlockLevel() {
    // this.indentTypes.push(indent_type_block_level);
    this.blockTypes.push(indent_type_block_level);
  }

  /**
   * Decreases indentation by one top-level indent.
   * Does nothing when the previous indent is not top-level.
   */
  decreaseTopLevel() {
    if (last(this.indentTypes) === indent_type_top_level) {
      this.indentTypes.pop();
    }
  }

  /**
   * Decreases indentation by one block-level indent.
   * If there are top-level indents within the block-level indent,
   * throws away these as well.
   */
  decreaseBlockLevel() {
    this.blockTypes.pop();
    // while (this.indentTypes.length > 0) {
    //   const type = this.indentTypes.pop();
    //   this.blockTypes.pop();
    //   if (type !== indent_type_top_level) {
    //     break;
    //   }
    // }
  }

  resetIndentation() {
    this.indentTypes = [];
  }
}
