using HistoryExplorer.Api;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<ExplorationCatalog>();
builder.Services.AddSingleton<PathStore>();

var app = builder.Build();
var catalog = app.Services.GetRequiredService<ExplorationCatalog>();
await app.Services.GetRequiredService<PathStore>().InitializeAsync();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/exploration", () => Results.Ok(catalog.Data));
app.MapGet("/api/paths", async (PathStore store) => Results.Ok(await store.ListAsync()));
app.MapGet("/api/paths/{id:guid}", async (Guid id, PathStore store) =>
    await store.GetAsync(id) is { } path ? Results.Ok(path) : Results.NotFound());
app.MapPost("/api/paths", async (SavePathRequest request, PathStore store) =>
{
    if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > 80)
        return Results.BadRequest(new { error = "标题需为 1–80 个字符。" });
    if (!catalog.IsValidPath(request.QuestionIds))
        return Results.BadRequest(new { error = "探索路径无效；请从精选问题出发并沿推荐方向前进。" });
    var saved = await store.SaveAsync(request.Title.Trim(), request.QuestionIds);
    return Results.Created($"/api/paths/{saved.Id}", saved);
});

app.Run();

public partial class Program { }
