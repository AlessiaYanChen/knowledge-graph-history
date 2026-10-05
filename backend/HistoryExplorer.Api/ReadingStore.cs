using Microsoft.Data.Sqlite;

namespace HistoryExplorer.Api;

public sealed record Book(Guid Id, string Title, string Author, string Description);
public sealed record Chapter(Guid Id, Guid BookId, string Title, string Summary, int Position);
public sealed record ReadingExcerpt(Guid Id, Guid ChapterId, string Label, string Text, int Position);
public sealed record ReadingNote(Guid Id, Guid ExcerptId, string Mode, string Text, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public sealed record ReadingSnapshot(List<Book> Books, List<Chapter> Chapters, List<ReadingExcerpt> Excerpts, List<ReadingNote> Notes);
public sealed record BookInput(string Title, string Author, string Description);
public sealed record ChapterInput(Guid BookId, string Title, string Summary);
public sealed record ChapterUpdate(string Title, string Summary);
public sealed record ExcerptInput(Guid ChapterId, string Label, string Text);
public sealed record ExcerptUpdate(string Label, string Text);
public sealed record NoteInput(Guid ExcerptId, string Mode, string Text);
public sealed record NoteUpdate(string Mode, string Text);

public sealed class ReadingStore(IWebHostEnvironment environment)
{
    private readonly string _connectionString = new SqliteConnectionStringBuilder
    {
        DataSource = Path.Combine(environment.ContentRootPath, "App_Data", "exploration.db"),
        ForeignKeys = true
    }.ToString();

    private SqliteConnection Open() => new(_connectionString);

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(Path.Combine(environment.ContentRootPath, "App_Data"));
        await using var connection = Open();
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS reading_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS books (
              id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL, description TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS chapters (
              id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
              title TEXT NOT NULL, summary TEXT NOT NULL, position INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS reading_excerpts (
              id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
              label TEXT NOT NULL, text TEXT NOT NULL, position INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS reading_notes (
              id TEXT PRIMARY KEY, excerpt_id TEXT NOT NULL REFERENCES reading_excerpts(id) ON DELETE CASCADE,
              mode TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_chapters_book ON chapters(book_id, position);
            CREATE INDEX IF NOT EXISTS ix_excerpts_chapter ON reading_excerpts(chapter_id, position);
            CREATE INDEX IF NOT EXISTS ix_notes_excerpt ON reading_notes(excerpt_id, created_at);
            """;
        await command.ExecuteNonQueryAsync();
        await SeedOnceAsync(connection);
    }

    private static async Task SeedOnceAsync(SqliteConnection connection)
    {
        var check = connection.CreateCommand();
        check.CommandText = "SELECT 1 FROM reading_metadata WHERE key = 'sample_seeded'";
        if (await check.ExecuteScalarAsync() is not null) return;

        await using var transaction = await connection.BeginTransactionAsync();
        var book = Guid.Parse("2d7d1d0f-5538-4cf6-9680-d6e7c16b1e48");
        var first = Guid.Parse("4ae2851a-49f4-4450-957c-d9bb642d3b17");
        var second = Guid.Parse("4f3c0fcf-2a72-43fd-8f50-e361e7500d9c");
        var statements = new[]
        {
            ("INSERT INTO books VALUES ($a,$b,$c,$d)", new object[] { book, "河岸练习", "项目原创示例", "一部为阅读工作流写作的虚构短篇。所有片段均为本站原创示例，并非真实出版物。" }),
            ("INSERT INTO chapters VALUES ($a,$b,$c,$d,1)", new object[] { first, book, "第一章 · 留白的地图", "从一张不完整的地图开始。" }),
            ("INSERT INTO chapters VALUES ($a,$b,$c,$d,2)", new object[] { second, book, "第二章 · 雨后的堤岸", "在一次同行中重看熟悉的地方。" }),
            ("INSERT INTO reading_excerpts VALUES ($a,$b,$c,$d,1)", new object[] { Guid.Parse("c4776689-f909-4b7f-87e1-a5bd83da0a1f"), first, "地图的空白", "祖父把地图铺在桌上，指尖停在一片没有标记的蓝色旁。他说，画图的人总想把路画完整，可走路的人最先记住的，常是那段没画出来的弯。" }),
            ("INSERT INTO reading_excerpts VALUES ($a,$b,$c,$d,2)", new object[] { Guid.Parse("494884af-fb5c-46e0-bca3-82c14615329a"), first, "两种记法", "我在空白处写下桥的名字，又把它擦掉。纸上只剩浅浅的凹痕，像一条已经有人走过、却还没有决定方向的小路。" }),
            ("INSERT INTO reading_excerpts VALUES ($a,$b,$c,$d,1)", new object[] { Guid.Parse("63a457f5-ddfa-4ea8-b24c-9aa658fe013e"), second, "雨后", "第二天雨停了，堤岸上的脚印有深有浅。我们没有争论哪一条才是昨天的路，只沿着都能看见的那一段慢慢往前走。" }),
            ("INSERT INTO reading_metadata VALUES ('sample_seeded','1')", Array.Empty<object>())
        };
        foreach (var (sql, values) in statements)
        {
            var command = connection.CreateCommand();
            command.Transaction = (SqliteTransaction)transaction;
            command.CommandText = sql;
            for (var i = 0; i < values.Length; i++)
                command.Parameters.AddWithValue("$" + (char)('a' + i), values[i] is Guid id ? id.ToString() : values[i]);
            await command.ExecuteNonQueryAsync();
        }
        await transaction.CommitAsync();
    }

    public async Task<ReadingSnapshot> GetSnapshotAsync()
    {
        var books = new List<Book>();
        var chapters = new List<Chapter>();
        var excerpts = new List<ReadingExcerpt>();
        var notes = new List<ReadingNote>();
        await using var connection = Open();
        await connection.OpenAsync();
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = "SELECT id,title,author,description FROM books ORDER BY title";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync()) books.Add(new(Guid.Parse(reader.GetString(0)), reader.GetString(1), reader.GetString(2), reader.GetString(3)));
        }
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = "SELECT id,book_id,title,summary,position FROM chapters ORDER BY book_id,position";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync()) chapters.Add(new(Guid.Parse(reader.GetString(0)), Guid.Parse(reader.GetString(1)), reader.GetString(2), reader.GetString(3), reader.GetInt32(4)));
        }
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = "SELECT id,chapter_id,label,text,position FROM reading_excerpts ORDER BY chapter_id,position";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync()) excerpts.Add(new(Guid.Parse(reader.GetString(0)), Guid.Parse(reader.GetString(1)), reader.GetString(2), reader.GetString(3), reader.GetInt32(4)));
        }
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = "SELECT id,excerpt_id,mode,text,created_at,updated_at FROM reading_notes ORDER BY updated_at DESC";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync()) notes.Add(new(Guid.Parse(reader.GetString(0)), Guid.Parse(reader.GetString(1)), reader.GetString(2), reader.GetString(3), DateTimeOffset.Parse(reader.GetString(4)), DateTimeOffset.Parse(reader.GetString(5))));
        }
        return new(books, chapters, excerpts, notes);
    }

    public Task<bool> ExistsBookAsync(Guid id) => ExistsAsync("books", id);
    public Task<bool> ExistsChapterAsync(Guid id) => ExistsAsync("chapters", id);
    public Task<bool> ExistsExcerptAsync(Guid id) => ExistsAsync("reading_excerpts", id);
    public Task<bool> ExistsNoteAsync(Guid id) => ExistsAsync("reading_notes", id);

    private async Task<bool> ExistsAsync(string table, Guid id)
    {
        await using var connection = Open();
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = $"SELECT 1 FROM {table} WHERE id=$id";
        command.Parameters.AddWithValue("$id", id.ToString());
        return await command.ExecuteScalarAsync() is not null;
    }

    private async Task<int> ExecuteAsync(string sql, params (string Name, object Value)[] parameters)
    {
        await using var connection = Open();
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = sql;
        foreach (var (name, value) in parameters) command.Parameters.AddWithValue(name, value is Guid id ? id.ToString() : value);
        return await command.ExecuteNonQueryAsync();
    }

    public async Task<Book> CreateBookAsync(BookInput input)
    {
        var book = new Book(Guid.NewGuid(), input.Title.Trim(), input.Author.Trim(), input.Description.Trim());
        await ExecuteAsync("INSERT INTO books VALUES ($id,$title,$author,$description)", ("$id", book.Id), ("$title", book.Title), ("$author", book.Author), ("$description", book.Description));
        return book;
    }
    public Task<int> UpdateBookAsync(Guid id, BookInput input) => ExecuteAsync("UPDATE books SET title=$title,author=$author,description=$description WHERE id=$id", ("$id", id), ("$title", input.Title.Trim()), ("$author", input.Author.Trim()), ("$description", input.Description.Trim()));
    public Task<int> DeleteBookAsync(Guid id) => ExecuteAsync("DELETE FROM books WHERE id=$id", ("$id", id));

    public async Task<Chapter> CreateChapterAsync(ChapterInput input)
    {
        var id = Guid.NewGuid();
        await ExecuteAsync("INSERT INTO chapters VALUES ($id,$book,$title,$summary,(SELECT COALESCE(MAX(position),0)+1 FROM chapters WHERE book_id=$book))", ("$id", id), ("$book", input.BookId), ("$title", input.Title.Trim()), ("$summary", input.Summary.Trim()));
        var snapshot = await GetSnapshotAsync();
        return snapshot.Chapters.Single(c => c.Id == id);
    }
    public Task<int> UpdateChapterAsync(Guid id, ChapterUpdate input) => ExecuteAsync("UPDATE chapters SET title=$title,summary=$summary WHERE id=$id", ("$id", id), ("$title", input.Title.Trim()), ("$summary", input.Summary.Trim()));
    public Task<int> DeleteChapterAsync(Guid id) => ExecuteAsync("DELETE FROM chapters WHERE id=$id", ("$id", id));

    public async Task<ReadingExcerpt> CreateExcerptAsync(ExcerptInput input)
    {
        var id = Guid.NewGuid();
        await ExecuteAsync("INSERT INTO reading_excerpts VALUES ($id,$chapter,$label,$text,(SELECT COALESCE(MAX(position),0)+1 FROM reading_excerpts WHERE chapter_id=$chapter))", ("$id", id), ("$chapter", input.ChapterId), ("$label", input.Label.Trim()), ("$text", input.Text.Trim()));
        var snapshot = await GetSnapshotAsync();
        return snapshot.Excerpts.Single(e => e.Id == id);
    }
    public Task<int> UpdateExcerptAsync(Guid id, ExcerptUpdate input) => ExecuteAsync("UPDATE reading_excerpts SET label=$label,text=$text WHERE id=$id", ("$id", id), ("$label", input.Label.Trim()), ("$text", input.Text.Trim()));
    public Task<int> DeleteExcerptAsync(Guid id) => ExecuteAsync("DELETE FROM reading_excerpts WHERE id=$id", ("$id", id));

    public async Task<ReadingNote> CreateNoteAsync(NoteInput input)
    {
        var now = DateTimeOffset.UtcNow;
        var note = new ReadingNote(Guid.NewGuid(), input.ExcerptId, input.Mode, input.Text.Trim(), now, now);
        await ExecuteAsync("INSERT INTO reading_notes VALUES ($id,$excerpt,$mode,$text,$created,$updated)", ("$id", note.Id), ("$excerpt", note.ExcerptId), ("$mode", note.Mode), ("$text", note.Text), ("$created", now.ToString("O")), ("$updated", now.ToString("O")));
        return note;
    }
    public Task<int> UpdateNoteAsync(Guid id, NoteUpdate input) => ExecuteAsync("UPDATE reading_notes SET mode=$mode,text=$text,updated_at=$updated WHERE id=$id", ("$id", id), ("$mode", input.Mode), ("$text", input.Text.Trim()), ("$updated", DateTimeOffset.UtcNow.ToString("O")));
    public Task<int> DeleteNoteAsync(Guid id) => ExecuteAsync("DELETE FROM reading_notes WHERE id=$id", ("$id", id));
}
