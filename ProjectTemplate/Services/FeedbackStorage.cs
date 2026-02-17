using System;
using System.Collections.Generic;
using System.IO;
using System.Web;
using Newtonsoft.Json;
using ProjectTemplate.Models;

namespace ProjectTemplate.Services
{
	public static class FeedbackStorage
	{
		private static readonly string DataFile = HttpContext.Current.Server.MapPath("~/App_Data/feedback.json");

		public static void Save(Feedback item)
		{
			List<Feedback> list;
			if (!File.Exists(DataFile))
			{
				list = new List<Feedback>();
			}
			else
			{
				var json = File.ReadAllText(DataFile);
				list = JsonConvert.DeserializeObject<List<Feedback>>(json) ?? new List<Feedback>();
			}
			list.Add(item);
			File.WriteAllText(DataFile, JsonConvert.SerializeObject(list, Formatting.Indented));
		}

		public static List<Feedback> GetAll()
		{
			if (!File.Exists(DataFile)) return new List<Feedback>();
			var json = File.ReadAllText(DataFile);
			return JsonConvert.DeserializeObject<List<Feedback>>(json) ?? new List<Feedback>();
		}
	}
}
