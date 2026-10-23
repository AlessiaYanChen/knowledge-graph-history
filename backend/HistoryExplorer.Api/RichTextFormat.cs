using System.Text.Json;

namespace HistoryExplorer.Api;

// Version 1 stores a restricted Tiptap/ProseMirror JSON document. The text column
// remains a searchable plain-text projection, while NULL rich_content means legacy text.
public static class RichTextFormat
{
    public static bool IsValid(string? text, string? richContent, int? version, int maxLength, bool required = true)
    {
        if (text is null || text.Length > maxLength || (required && string.IsNullOrWhiteSpace(text))) return false;
        if (richContent is null) return version is null;
        if (version != 1 || richContent.Length > 60000) return false;
        try
        {
            using var json = JsonDocument.Parse(richContent);
            return Read(json.RootElement, 0, "root") == text;
        }
        catch (JsonException) { return false; }
        catch (FormatException) { return false; }
        catch (InvalidOperationException) { return false; }
    }

    private static string Read(JsonElement node, int depth, string parent)
    {
        if (depth > 30 || node.ValueKind != JsonValueKind.Object) throw new FormatException();
        if (!node.TryGetProperty("type", out var typeValue) || typeValue.ValueKind != JsonValueKind.String) throw new FormatException();
        var type = typeValue.GetString();
        if (type is not ("doc" or "paragraph" or "text" or "hardBreak" or "bulletList" or "orderedList" or "listItem" or "blockquote")) throw new FormatException();
        if ((parent == "root" && type != "doc") || (type == "doc" && parent != "root")) throw new FormatException();
        if (parent == "doc" && type is not ("paragraph" or "bulletList" or "orderedList" or "blockquote")) throw new FormatException();
        if (parent is "bulletList" or "orderedList" && type != "listItem") throw new FormatException();
        if (parent == "paragraph" && type is not ("text" or "hardBreak")) throw new FormatException();
        if (parent == "listItem" && type is not ("paragraph" or "bulletList" or "orderedList")) throw new FormatException();
        if (parent == "blockquote" && type is not ("paragraph" or "bulletList" or "orderedList")) throw new FormatException();
        if (type is "text" or "hardBreak" && parent != "paragraph") throw new FormatException();
        foreach (var property in node.EnumerateObject())
        {
            if (property.Name == "attrs")
            {
                if (type != "orderedList") throw new FormatException();
                ValidateOrderedListAttributes(property.Value);
                continue;
            }
            if (property.Name is not ("type" or "content" or "text" or "marks")) throw new FormatException();
            if (property.Name == "marks")
            {
                if (type != "text" || property.Value.ValueKind != JsonValueKind.Array) throw new FormatException();
                foreach (var mark in property.Value.EnumerateArray())
                {
                    if (mark.ValueKind != JsonValueKind.Object || mark.EnumerateObject().Count() != 1 ||
                        !mark.TryGetProperty("type", out var markType) || markType.GetString() is not ("bold" or "italic")) throw new FormatException();
                }
            }
        }
        if (type == "text")
        {
            if (!node.TryGetProperty("text", out var value) || value.ValueKind != JsonValueKind.String || node.TryGetProperty("content", out _)) throw new FormatException();
            return value.GetString()!;
        }
        if (node.TryGetProperty("text", out _)) throw new FormatException();
        if (type == "hardBreak") return "\n";
        if (!node.TryGetProperty("content", out var content)) return "";
        if (content.ValueKind != JsonValueKind.Array) throw new FormatException();
        var separator = type == "paragraph" ? "" : "\n";
        return string.Join(separator, content.EnumerateArray().Select(child => Read(child, depth + 1, type!)));
    }

    private static void ValidateOrderedListAttributes(JsonElement attributes)
    {
        if (attributes.ValueKind != JsonValueKind.Object) throw new FormatException();
        foreach (var property in attributes.EnumerateObject())
        {
            if (property.Name == "start")
            {
                if (property.Value.ValueKind != JsonValueKind.Number ||
                    !property.Value.TryGetInt32(out var start) || start < 1) throw new FormatException();
            }
            else if (property.Name == "type")
            {
                // StarterKit's default ordered list writes type: null.
                if (property.Value.ValueKind != JsonValueKind.Null) throw new FormatException();
            }
            else throw new FormatException();
        }
    }
}
