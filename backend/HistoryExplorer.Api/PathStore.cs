using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace HistoryExplorer.Api;

public sealed record SavePathRequest(string Title, string[] QuestionIds);
public sealed record SavedPath(Guid Id, string Title, string[] QuestionIds, DateTimeOffset CreatedAt);

public sealed class PathStore(IWebHostEnvironment environment)
{
    private readonly string _connectionString = new SqliteConnectionStringBuilder
    {
        DataSource = Path.Combine(environment.ContentRootPath, "App_Data", "exploration.db")
    }.ToString();

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(Path.Combine(environment.ContentRootPath, "App_Data"));
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS saved_paths (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                question_ids TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """;
        await command.ExecuteNonQueryAsync();
    }

    public async Task<SavedPath> SaveAsync(string title, string[] questionIds)
    {
        var path = new SavedPath(Guid.NewGuid(), title, questionIds, DateTimeOffset.UtcNow);
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO saved_paths (id, title, question_ids, created_at) VALUES ($id, $title, $ids, $created)";
        command.Parameters.AddWithValue("$id", path.Id.ToString());
        command.Parameters.AddWithValue("$title", path.Title);
        command.Parameters.AddWithValue("$ids", JsonSerializer.Serialize(path.QuestionIds));
        command.Parameters.AddWithValue("$created", path.CreatedAt.ToString("O"));
        await command.ExecuteNonQueryAsync();
        return path;
    }

    public async Task<SavedPath?> GetAsync(Guid id)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = "SELECT id, title, question_ids, created_at FROM saved_paths WHERE id = $id";
        command.Parameters.AddWithValue("$id", id.ToString());
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Read(reader) : null;
    }

    public async Task<List<SavedPath>> ListAsync()
    {
        var paths = new List<SavedPath>();
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        var command = connection.CreateCommand();
        command.CommandText = "SELECT id, title, question_ids, created_at FROM saved_paths ORDER BY created_at DESC LIMIT 30";
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync()) paths.Add(Read(reader));
        return paths;
    }

    private static SavedPath Read(SqliteDataReader reader) => new(
        Guid.Parse(reader.GetString(0)), reader.GetString(1),
        JsonSerializer.Deserialize<string[]>(reader.GetString(2)) ?? [],
        DateTimeOffset.Parse(reader.GetString(3)));
}
