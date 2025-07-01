import { assertEquals } from "./deps.ts";
import { describe, it } from "./deps.ts";
import { diffChars, diffLines } from "./deps.ts";

describe("diff functions integration", () => {
  describe("diffChars", () => {
    it("should detect character additions", () => {
      const before = "hello world";
      const after = "hello beautiful world";

      const changes = diffChars(before, after);

      assertEquals(changes.length, 3);
      assertEquals(changes[0].value, "hello ");
      assertEquals(changes[0].added, undefined);
      assertEquals(changes[0].removed, undefined);

      assertEquals(changes[1].value, "beautiful ");
      assertEquals(changes[1].added, true);

      assertEquals(changes[2].value, "world");
      assertEquals(changes[2].added, undefined);
      assertEquals(changes[2].removed, undefined);
    });

    it("should detect character removals", () => {
      const before = "hello beautiful world";
      const after = "hello world";

      const changes = diffChars(before, after);

      assertEquals(changes.length, 3);
      assertEquals(changes[1].value, "beautiful ");
      assertEquals(changes[1].removed, true);
    });

    it("should handle multi-line text", () => {
      const before = "line1\nline2\nline3";
      const after = "line1\nmodified line2\nline3";

      const changes = diffChars(before, after);

      const addedChange = changes.find((c) => c.added);

      // The character diff just adds "modified " before "line2"
      assertEquals(addedChange?.value, "modified ");
      assertEquals(changes.some((c) => c.value.includes("line2")), true);
    });

    it("should handle empty strings", () => {
      const changes1 = diffChars("", "hello");
      assertEquals(changes1.length, 1);
      assertEquals(changes1[0].value, "hello");
      assertEquals(changes1[0].added, true);

      const changes2 = diffChars("hello", "");
      assertEquals(changes2.length, 1);
      assertEquals(changes2[0].value, "hello");
      assertEquals(changes2[0].removed, true);
    });
  });

  describe("diffLines", () => {
    it("should detect line additions", () => {
      const before = "line1\nline2";
      const after = "line1\nnew line\nline2";

      const changes = diffLines(before, after);

      assertEquals(changes.length, 3);
      assertEquals(changes[1].value, "new line\n");
      assertEquals(changes[1].added, true);
    });

    it("should detect line removals", () => {
      const before = "line1\nold line\nline2";
      const after = "line1\nline2";

      const changes = diffLines(before, after);

      assertEquals(changes.length, 3);
      assertEquals(changes[1].value, "old line\n");
      assertEquals(changes[1].removed, true);
    });

    it("should detect line modifications", () => {
      const before = "line1\noriginal\nline3";
      const after = "line1\nmodified\nline3";

      const changes = diffLines(before, after);

      const removed = changes.find((c) => c.removed);
      const added = changes.find((c) => c.added);

      assertEquals(removed?.value, "original\n");
      assertEquals(added?.value, "modified\n");
    });

    it("should handle trailing newlines correctly", () => {
      const before = "line1\nline2\n";
      const after = "line1\nline2";

      const changes = diffLines(before, after);

      // Should detect the removal of content, might not be just "\n"
      const hasRemoved = changes.some((c) => c.removed);
      assertEquals(hasRemoved, true);
    });
  });

  describe("edge cases", () => {
    it("should handle unicode characters", () => {
      const before = "hello 世界";
      const after = "hello 🌍";

      const changes = diffChars(before, after);

      const removed = changes.find((c) => c.removed);
      const added = changes.find((c) => c.added);

      assertEquals(removed?.value, "世界");
      assertEquals(added?.value, "🌍");
    });

    it("should handle very long lines", () => {
      const longString = "a".repeat(1000);
      const before = `start ${longString} end`;
      const after = `start ${longString} modified end`;

      const changes = diffChars(before, after);

      // Should have additions for the "modified" part
      const hasAdded = changes.some((c) => c.added);
      assertEquals(hasAdded, true);

      // The total diff should add 9 characters ("modified ")
      const totalAdded = changes.filter((c) => c.added).reduce((sum, c) => sum + c.count!, 0);
      assertEquals(totalAdded, 9);
    });

    it("should handle mixed line endings", () => {
      const before = "line1\r\nline2\nline3";
      const after = "line1\nline2\nline3";

      const changes = diffChars(before, after);

      // Should detect the change in line endings
      const hasChange = changes.length > 1;
      assertEquals(hasChange, true);
    });
  });
});
