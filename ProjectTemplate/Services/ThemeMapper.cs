using ProjectTemplate.Models;
using System.Collections.Generic;

namespace ProjectTemplate.Services
{
	public static class ThemeMapper
	{
		private static readonly Dictionary<string, string> KeywordMap = new Dictionary<string, string>
		{
			{ "meeting", "Communication" },
			{ "communicat", "Communication" },
			{ "email", "Communication" },
			{ "tool", "Tools" },
			{ "software", "Tools" },
			{ "system", "Tools" },
			{ "deadline", "Workload" },
			{ "workload", "Workload" },
			{ "hours", "Workload" },
			{ "manager", "Management" },
			{ "lead", "Management" }
		};

		public static string MapTheme(Feedback fb)
		{
			var text = (fb?.Issue + " " + fb?.Impact + " " + fb?.Suggestion)?.ToLower() ?? "";
			foreach (var kv in KeywordMap)
			{
				if (text.Contains(kv.Key)) return kv.Value;
			}
			return "Other";
		}

		public static void AssignTheme(Feedback fb)
		{
			if (fb == null) return;
			fb.Theme = MapTheme(fb);
		}
	}
}
