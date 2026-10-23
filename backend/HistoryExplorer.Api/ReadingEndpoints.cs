namespace HistoryExplorer.Api;

public static class ReadingEndpoints
{
    private static bool TextOkay(string? value, int max, bool required = true) =>
        value is not null && value.Length <= max && (!required || !string.IsNullOrWhiteSpace(value));
    private static bool BookOkay(BookInput value) => TextOkay(value.Title, 120) && TextOkay(value.Author, 120, false) && RichTextFormat.IsValid(value.Description, value.RichContent, value.FormatVersion, 1000, false);
    private static bool ChapterOkay(string title, string summary, string? rich, int? version) => TextOkay(title, 120) && RichTextFormat.IsValid(summary, rich, version, 1000, false);
    private static bool ExcerptOkay(string label, string text, string? rich, int? version) => TextOkay(label, 120) && RichTextFormat.IsValid(text, rich, version, 5000);
    private static bool NoteOkay(string mode, string text, string? rich, int? version) => new[] { "understand", "question", "connect", "reflect" }.Contains(mode) && RichTextFormat.IsValid(text, rich, version, 5000);
    private static IResult Invalid() => Results.BadRequest(new { error = "请检查必填内容及长度。" });

    public static void MapReadingEndpoints(this WebApplication app)
    {
        var api = app.MapGroup("/api/reading");
        api.MapGet("/", async (ReadingStore store) => Results.Ok(await store.GetSnapshotAsync()));

        api.MapPost("/books", async (BookInput input, ReadingStore store) =>
            !BookOkay(input) ? Invalid() : Results.Created("/api/reading/", await store.CreateBookAsync(input)));
        api.MapPut("/books/{id:guid}", async (Guid id, BookInput input, ReadingStore store) =>
            !BookOkay(input) ? Invalid() : await store.UpdateBookAsync(id, input) == 0 ? Results.NotFound() : Results.NoContent());
        api.MapDelete("/books/{id:guid}", async (Guid id, ReadingStore store) =>
            await store.DeleteBookAsync(id) == 0 ? Results.NotFound() : Results.NoContent());

        api.MapPost("/chapters", async (ChapterInput input, ReadingStore store) =>
        {
            if (!ChapterOkay(input.Title, input.Summary, input.RichContent, input.FormatVersion)) return Invalid();
            if (!await store.ExistsBookAsync(input.BookId)) return Results.NotFound(new { error = "书籍不存在。" });
            return Results.Created("/api/reading/", await store.CreateChapterAsync(input));
        });
        api.MapPut("/chapters/{id:guid}", async (Guid id, ChapterUpdate input, ReadingStore store) =>
            !ChapterOkay(input.Title, input.Summary, input.RichContent, input.FormatVersion) ? Invalid() : await store.UpdateChapterAsync(id, input) == 0 ? Results.NotFound() : Results.NoContent());
        api.MapDelete("/chapters/{id:guid}", async (Guid id, ReadingStore store) =>
            await store.DeleteChapterAsync(id) == 0 ? Results.NotFound() : Results.NoContent());

        api.MapPost("/excerpts", async (ExcerptInput input, ReadingStore store) =>
        {
            if (!ExcerptOkay(input.Label, input.Text, input.RichContent, input.FormatVersion)) return Invalid();
            if (!await store.ExistsChapterAsync(input.ChapterId)) return Results.NotFound(new { error = "章节不存在。" });
            return Results.Created("/api/reading/", await store.CreateExcerptAsync(input));
        });
        api.MapPut("/excerpts/{id:guid}", async (Guid id, ExcerptUpdate input, ReadingStore store) =>
            !ExcerptOkay(input.Label, input.Text, input.RichContent, input.FormatVersion) ? Invalid() : await store.UpdateExcerptAsync(id, input) == 0 ? Results.NotFound() : Results.NoContent());
        api.MapDelete("/excerpts/{id:guid}", async (Guid id, ReadingStore store) =>
            await store.DeleteExcerptAsync(id) == 0 ? Results.NotFound() : Results.NoContent());

        api.MapPost("/notes", async (NoteInput input, ReadingStore store) =>
        {
            if (!NoteOkay(input.Mode, input.Text, input.RichContent, input.FormatVersion)) return Invalid();
            if (!await store.ExistsExcerptAsync(input.ExcerptId)) return Results.NotFound(new { error = "片段不存在。" });
            return Results.Created("/api/reading/", await store.CreateNoteAsync(input));
        });
        api.MapPut("/notes/{id:guid}", async (Guid id, NoteUpdate input, ReadingStore store) =>
            !NoteOkay(input.Mode, input.Text, input.RichContent, input.FormatVersion) ? Invalid() : await store.UpdateNoteAsync(id, input) == 0 ? Results.NotFound() : Results.NoContent());
        api.MapDelete("/notes/{id:guid}", async (Guid id, ReadingStore store) =>
            await store.DeleteNoteAsync(id) == 0 ? Results.NotFound() : Results.NoContent());
    }
}
