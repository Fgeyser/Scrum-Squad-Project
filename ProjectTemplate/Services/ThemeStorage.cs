using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web;
using Newtonsoft.Json;

namespace ProjectTemplate.Services
{
	public class ThemeCount
	{
		public string Theme { get; set; }
		public int Count { get; set; }
	}

	public static class ThemeStorage
	{
		private static readonly string FilePath = HttpContext.Current.Server.MapPath("~/App_Data/themes.json");
		private static readonly object _lock = new object();

		public static List<ThemeCount> GetAll()
		{
			lock (_lock)
			{
				if (!File.Exists(FilePath))
				{
					return new List<ThemeCount>();
				}

				var json = File.ReadAllText(FilePath);
				var list = JsonConvert.DeserializeObject<List<ThemeCount>>(json) ?? new List<ThemeCount>();
				return list;
			}
		}

		public static void SaveAll(List<ThemeCount> list)
		{
			lock (_lock)
			{
				var json = JsonConvert.SerializeObject(list, Formatting.Indented);
				File.WriteAllText(FilePath, json);
			}
		}

		public static void Increment(string theme)
		{
			lock (_lock)
			{
				var list = GetAll();
				var item = list.FirstOrDefault(t => string.Equals(t.Theme, theme, StringComparison.OrdinalIgnoreCase));
				if (item == null)
				{
					item = new ThemeCount { Theme = theme, Count = 1 };
					list.Add(item);
				}
				else
				{
					item.Count++;
				}
				SaveAll(list);
			}
		}
	}
}
