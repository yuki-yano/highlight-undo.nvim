import { assertEquals } from "../deps.ts";
import { describe, it } from "../deps.ts";
import {
  getByteLength,
  getDisplayWidth,
  jsIndexToVimColumn,
  safeSlice,
  splitIntoGraphemes,
  vimColumnToJsIndex,
} from "./encoding.ts";

describe("Encoding utilities", () => {
  describe("jsIndexToVimColumn", () => {
    it("should handle ASCII text", () => {
      const text = "hello world";
      assertEquals(jsIndexToVimColumn(text, 0), 1);
      assertEquals(jsIndexToVimColumn(text, 5), 6);
      assertEquals(jsIndexToVimColumn(text, 11), 12);
    });

    it("should handle Japanese text", () => {
      const text = "こんにちは";
      // Each hiragana character is 3 bytes in UTF-8
      assertEquals(jsIndexToVimColumn(text, 0), 1);
      assertEquals(jsIndexToVimColumn(text, 1), 4); // After "こ"
      assertEquals(jsIndexToVimColumn(text, 2), 7); // After "こん"
      assertEquals(jsIndexToVimColumn(text, 5), 16); // After all
    });

    it("should handle emoji", () => {
      const text = "Hello 👋 World";
      assertEquals(jsIndexToVimColumn(text, 0), 1);
      assertEquals(jsIndexToVimColumn(text, 6), 7); // Before emoji
      assertEquals(jsIndexToVimColumn(text, 8), 11); // After emoji (4 bytes)
    });

    it("should handle mixed text", () => {
      const text = "日本語とEnglish";
      assertEquals(jsIndexToVimColumn(text, 0), 1);
      assertEquals(jsIndexToVimColumn(text, 3), 10); // After "日本語"
      assertEquals(jsIndexToVimColumn(text, 4), 13); // After "日本語と"
    });
  });

  describe("vimColumnToJsIndex", () => {
    it("should handle ASCII text", () => {
      const text = "hello world";
      assertEquals(vimColumnToJsIndex(text, 1), 0);
      assertEquals(vimColumnToJsIndex(text, 6), 5);
      assertEquals(vimColumnToJsIndex(text, 12), 11);
    });

    it("should handle Japanese text", () => {
      const text = "こんにちは";
      assertEquals(vimColumnToJsIndex(text, 1), 0);
      assertEquals(vimColumnToJsIndex(text, 4), 1); // Start of "ん"
      assertEquals(vimColumnToJsIndex(text, 7), 2); // Start of "に"
      assertEquals(vimColumnToJsIndex(text, 16), 5); // End of string
    });
  });

  describe("getByteLength", () => {
    it("should calculate byte length correctly", () => {
      assertEquals(getByteLength("hello"), 5);
      assertEquals(getByteLength("こんにちは"), 15); // 3 bytes × 5 chars
      assertEquals(getByteLength("👋"), 4); // Emoji is 4 bytes
      assertEquals(getByteLength("café"), 5); // é is 2 bytes
    });
  });

  describe("getDisplayWidth", () => {
    it("should calculate display width for ASCII", () => {
      assertEquals(getDisplayWidth("hello"), 5);
      assertEquals(getDisplayWidth("hello world"), 11);
    });

    it("should calculate display width for CJK characters", () => {
      assertEquals(getDisplayWidth("日本語"), 6); // 2 × 3
      assertEquals(getDisplayWidth("こんにちは"), 10); // 2 × 5
      assertEquals(getDisplayWidth("中文"), 4); // 2 × 2
    });

    it("should calculate display width for mixed text", () => {
      assertEquals(getDisplayWidth("Hello世界"), 9); // 5 + 2×2
      assertEquals(getDisplayWidth("A日B"), 4); // 1 + 2 + 1
    });

    it("should handle emoji as wide characters", () => {
      assertEquals(getDisplayWidth("👋"), 2);
      assertEquals(getDisplayWidth("Hello👋"), 7); // 5 + 2
    });
  });

  describe("splitIntoGraphemes", () => {
    it("should split ASCII text", () => {
      const result = splitIntoGraphemes("hello");
      assertEquals(result, ["h", "e", "l", "l", "o"]);
    });

    it("should handle combining characters", () => {
      const text = "é"; // e + combining acute accent
      const result = splitIntoGraphemes(text);
      assertEquals(result.length, 1); // Should be treated as one grapheme
    });

    it("should split CJK characters", () => {
      const result = splitIntoGraphemes("日本語");
      assertEquals(result, ["日", "本", "語"]);
    });
  });

  describe("safeSlice", () => {
    it("should slice ASCII text normally", () => {
      assertEquals(safeSlice("hello world", 0, 5), "hello");
      assertEquals(safeSlice("hello world", 6, 11), "world");
    });

    it("should handle grapheme clusters", () => {
      const text = "café"; // é might be a combining character
      assertEquals(safeSlice(text, 0, 3), "caf");
      assertEquals(safeSlice(text, 3, 4), "é");
    });

    it("should handle emoji and CJK", () => {
      const text = "Hello👋世界";
      assertEquals(safeSlice(text, 0, 5), "Hello");
      assertEquals(safeSlice(text, 5, 6), "👋");
      assertEquals(safeSlice(text, 6, 8), "世界");
    });
  });
});
