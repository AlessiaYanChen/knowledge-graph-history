using System.Text.Json;

namespace HistoryExplorer.Api;

public sealed record HistoricalContext(string? Period, string? Place, string? InterpretationNote);
public sealed record Source(string Id, string Title, string Publisher, string Url, string ReviewStatus, string? Note);
public sealed record Question(string Id, string Title, string Eyebrow, string Summary, string[] Points,
    HistoricalContext Context, string[] SourceIds, string ReviewStatus);
public sealed record Recommendation(string FromQuestionId, string ToQuestionId, string Reason);
public sealed record MapNode(string Id, string Label, string Kind, string? QuestionId);
public sealed record KnowledgeRelation(string FromNodeId, string ToNodeId, string Type, string Label,
    string ReviewStatus, string[] SourceIds);
public sealed record ExplorationData(string Theme, string Intro, string[] FeaturedQuestionIds,
    Question[] Questions, Recommendation[] Recommendations, MapNode[] MapNodes,
    KnowledgeRelation[] KnowledgeRelations, Source[] Sources);

public sealed class ExplorationCatalog
{
    public ExplorationData Data { get; }

    public ExplorationCatalog(IWebHostEnvironment environment)
    {
        var file = Path.Combine(environment.ContentRootPath, "Data", "exploration.json");
        Data = JsonSerializer.Deserialize<ExplorationData>(File.ReadAllText(file),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidOperationException("示例数据为空。");
    }

    public bool IsValidPath(string[]? ids)
    {
        if (ids is null || ids.Length is < 1 or > 30 || !Data.FeaturedQuestionIds.Contains(ids[0])) return false;
        var known = Data.Questions.Select(q => q.Id).ToHashSet();
        if (ids.Any(id => !known.Contains(id))) return false;
        return ids.Zip(ids.Skip(1)).All(pair => Data.Recommendations.Any(r =>
            r.FromQuestionId == pair.First && r.ToQuestionId == pair.Second));
    }
}
