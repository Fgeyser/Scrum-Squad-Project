using System;

namespace ProjectTemplate.Models
{
	public class Feedback
	{
		public string Issue { get; set; }
		public string Impact { get; set; }
		public string Suggestion { get; set; }
		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
		public string Theme { get; set; } // assigned later by ThemeMapper
	}
}
