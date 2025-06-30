import { assertEquals } from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.173.0/testing/bdd.ts";
import { EncodingUtil } from "./encoding.ts";

describe("EncodingUtil", () => {
  describe("jsIndexToVimColumn", () => {
    it("should handle ASCII text", () => {
      const text = "hello world";
      assertEquals(EncodingUtil.jsIndexToVimColumn(text, 0), 1);
      assertEquals(EncodingUtil.jsIndexToVimColumn(text, 5), 6);
      assertEquals(EncodingUtil.jsIndexToVimColumn(text, 11), 12);
    });

    it("should handle Japanese text", () => {
      const text = "こんにちは";
      // Each hiragana character is 3 bytes in UTF-8
      assertEquals(EncodingUtil.jsIndexToVimColumn(text, 0), 1);
      assertEquals(EncodingUtil.jsIndexToVimColumn(text, 1), 4); // After "こ"
      assertEquals(EncodingUtil.jsIndexToVimColumn(text, 2), 7); // After "こん"
      assertEquals(EncodingUtil.jsIndexToVimColumn(text, 5), 16); // After all
    });

    it("should handle emoji", () => {
      const text = "Hello 👋 World";
      assertEquals(EncodingUtil.jsIndexToVimColumn(text, 0), 1);
      assertEquals(EncodingUtil.jsIndexToVimColumn(text, 6), 7); // Before emoji
      assertEquals(EncodingUtil.jsIndexToVimColumn(text, 8), 11); // After emoji (4 bytes)
    });

    it("should handle mixed text", () => {
      const text = "日本語とEnglish";
      assertEquals(EncodingUtil.jsIndexToVimColumn(text, 0), 1);
      assertEquals(EncodingUtil.jsIndexToVimColumn(text, 3), 10); // After "日本語"
      assertEquals(EncodingUtil.jsIndexToVimColumn(text, 4), 13); // After "日本語と"
    });
  });

  describe("vimColumnToJsIndex", () => {
    it("should handle ASCII text", () => {
      const text = "hello world";
      assertEquals(EncodingUtil.vimColumnToJsIndex(text, 1), 0);
      assertEquals(EncodingUtil.vimColumnToJsIndex(text, 6), 5);
      assertEquals(EncodingUtil.vimColumnToJsIndex(text, 12), 11);
    });

    it("should handle Japanese text", () => {
      const text = "こんにちは";
      assertEquals(EncodingUtil.vimColumnToJsIndex(text, 1), 0);
      assertEquals(EncodingUtil.vimColumnToJsIndex(text, 4), 1); // Start of "ん"
      assertEquals(EncodingUtil.vimColumnToJsIndex(text, 7), 2); // Start of "に"
      assertEquals(EncodingUtil.vimColumnToJsIndex(text, 16), 5); // End of string
    });
  });

  describe("getByteLength", () => {
    it("should calculate byte length correctly", () => {
      assertEquals(EncodingUtil.getByteLength("hello"), 5);
      assertEquals(EncodingUtil.getByteLength("こんにちは"), 15); // 3 bytes × 5 chars
      assertEquals(EncodingUtil.getByteLength("👋"), 4); // Emoji is 4 bytes
      assertEquals(EncodingUtil.getByteLength("café"), 5); // é is 2 bytes
    });
  });

  describe("getDisplayWidth", () => {
    it("should calculate display width for ASCII", () => {
      assertEquals(EncodingUtil.getDisplayWidth("hello"), 5);
      assertEquals(EncodingUtil.getDisplayWidth("hello world"), 11);
    });

    it("should calculate display width for CJK characters", () => {
      assertEquals(EncodingUtil.getDisplayWidth("日本語"), 6); // 2 × 3
      assertEquals(EncodingUtil.getDisplayWidth("こんにちは"), 10); // 2 × 5
      assertEquals(EncodingUtil.getDisplayWidth("中文"), 4); // 2 × 2
    });

    it("should calculate display width for mixed text", () => {
      assertEquals(EncodingUtil.getDisplayWidth("Hello世界"), 9); // 5 + 2×2
      assertEquals(EncodingUtil.getDisplayWidth("A日B"), 4); // 1 + 2 + 1
    });

    it("should handle emoji as wide characters", () => {
      assertEquals(EncodingUtil.getDisplayWidth("👋"), 2);
      assertEquals(EncodingUtil.getDisplayWidth("Hello👋"), 7); // 5 + 2
    });
  });

  describe("splitIntoGraphemes", () => {
    it("should split ASCII text", () => {
      const result = EncodingUtil.splitIntoGraphemes("hello");
      assertEquals(result, ["h", "e", "l", "l", "o"]);
    });

    it("should handle combining characters", () => {
      const text = "é"; // e + combining acute accent
      const result = EncodingUtil.splitIntoGraphemes(text);
      assertEquals(result.length, 1); // Should be treated as one grapheme
    });

    it("should split CJK characters", () => {
      const result = EncodingUtil.splitIntoGraphemes("日本語");
      assertEquals(result, ["日", "本", "語"]);
    });
  });

  describe("safeSlice", () => {
    it("should slice ASCII text normally", () => {
      assertEquals(EncodingUtil.safeSlice("hello world", 0, 5), "hello");
      assertEquals(EncodingUtil.safeSlice("hello world", 6, 11), "world");
    });

    it("should handle grapheme clusters", () => {
      const text = "café"; // é might be a combining character
      assertEquals(EncodingUtil.safeSlice(text, 0, 3), "caf");
      assertEquals(EncodingUtil.safeSlice(text, 3, 4), "é");
    });

    it("should handle emoji and CJK", () => {
      const text = "Hello👋世界";
      assertEquals(EncodingUtil.safeSlice(text, 0, 5), "Hello");
      assertEquals(EncodingUtil.safeSlice(text, 5, 6), "👋");
      assertEquals(EncodingUtil.safeSlice(text, 6, 8), "世界");
    });
  });
});
