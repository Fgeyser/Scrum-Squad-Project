using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Web;
using System.Web.Script.Services;
using System.Web.Services;
using MySql.Data;
using MySql.Data.MySqlClient;
using ProjectTemplate.Models;
using ProjectTemplate.Services;

namespace ProjectTemplate
{
	// Serializable DTOs for aggregated report
	public class CountItem
	{
		public string Key { get; set; }
		public int Count { get; set; }

		// Required for XML serialization
		public CountItem() { }

		public CountItem(string key, int count)
		{
			Key = key;
			Count = count;
		}
	}

	public class Feedback
	{
		// ===================== UPDATES SYSTEM =====================

		[WebMethod(EnableSession = true)]
		[System.Web.Script.Services.ScriptMethod(ResponseFormat = ResponseFormat.Json)]
		public string AddUpdate(string postId, string content)
		{
			// Only admins/employers can add updates
			var roleObj = Session["role"];
			var normalizedRole = NormalizeRole(roleObj?.ToString() ?? "");
			if (normalizedRole != "admin" && normalizedRole != "employer")
			{
				Context.Response.StatusCode = 403;
				return "error: unauthorized";
			}
			if (string.IsNullOrWhiteSpace(postId) || string.IsNullOrWhiteSpace(content))
				return "error: missing postId or content";

			var update = new Update
			{
				PostId = postId,
				Content = content,
				AuthorRole = normalizedRole,
				Timestamp = DateTime.UtcNow
			};
			try
			{
				UpdateStorage.Save(update);
				return "ok";
			}
			catch (Exception ex)
			{
				return "error: " + ex.Message;
			}
		}

		[WebMethod(EnableSession = true)]
		[System.Web.Script.Services.ScriptMethod(ResponseFormat = ResponseFormat.Json)]
		public List<Update> GetUpdatesForPost(string postId)
		{
			if (string.IsNullOrWhiteSpace(postId))
				return new List<Update>();
			try
			{
				return UpdateStorage.GetByPostId(postId);
			}
			catch
			{
				return new List<Update>();
			}
		}

		[WebMethod(EnableSession = true)]
		[System.Web.Script.Services.ScriptMethod(ResponseFormat = ResponseFormat.Json)]
		public List<Update> GetAllUpdates()
		{
			try
			{
				return UpdateStorage.GetAll();
			}
			catch
			{
				return new List<Update>();
			}
		}
		}
	public class AggregatedReportDto
	{
		public int TotalCount { get; set; }
		public CountItem[] CountsPerTheme { get; set; }
		public CountItem[] CountsPerDay { get; set; }

		public AggregatedReportDto() { }
	}

	[WebService(Namespace = "http://tempuri.org/")]
	[WebServiceBinding(ConformsTo = WsiProfiles.BasicProfile1_1)]
	[System.ComponentModel.ToolboxItem(false)]
	[System.Web.Script.Services.ScriptService]
	public class ProjectServices : System.Web.Services.WebService
	{
		////////////////////////////////////////////////////////////////////////
		///replace the values of these variables with your database credentials
		////////////////////////////////////////////////////////////////////////
		private string dbID = "cis440Spring2026team2";
		private string dbPass = "cis440Spring2026team2";
		private string dbName = "cis440Spring2026team2";
		////////////////////////////////////////////////////////////////////////

		private string getConString()
		{
			return "SERVER=107.180.1.16; PORT=3306; DATABASE=" + dbName +
				   "; UID=" + dbID + "; PASSWORD=" + dbPass;
		}

		[WebMethod(EnableSession = true)]
		public string TestConnection()
		{
			try
			{
				string testQuery = "select * from test";
				MySqlConnection con = new MySqlConnection(getConString());
				MySqlCommand cmd = new MySqlCommand(testQuery, con);
				MySqlDataAdapter adapter = new MySqlDataAdapter(cmd);
				DataTable table = new DataTable();
				adapter.Fill(table);
				return "Success!";
			}
			catch (Exception e)
			{
				return "Database connection failed: " + e.Message;
			}
		}

		[WebMethod(EnableSession = true)]
		public string SubmitAnonymousFeedback(string issue, string impact, string suggestion)
		{
			try
			{
				var fb = new Feedback
				{
					Issue = issue,
					Impact = impact,
					Suggestion = suggestion,
					CreatedAt = DateTime.UtcNow
				};

				try
				{
					ThemeMapper.AssignTheme(fb);
				}
				catch { }

				FeedbackStorage.Save(fb);

				try
				{
					var themeToIncrement = string.IsNullOrWhiteSpace(fb.Theme)
						? "Other"
						: fb.Theme;

					ThemeStorage.Increment(themeToIncrement);
				}
				catch { }

				return "ok";
			}
			catch (Exception ex)
			{
				return "error: " + ex.Message;
			}
		}

		[WebMethod(EnableSession = true)]
		public List<Feedback> GetAllFeedback()
		{
			try
			{
				return FeedbackStorage.GetAll();
			}
			catch
			{
				return new List<Feedback>();
			}
		}

		[WebMethod(EnableSession = true)]
		public List<ThemeCount> GetThemeCounts()
		{
			try
			{
				return ThemeStorage.GetAll();
			}
			catch
			{
				return new List<ThemeCount>();
			}
		}

		[WebMethod(EnableSession = true)]
		public string UpvoteTheme(string theme)
		{
			try
			{
				if (string.IsNullOrWhiteSpace(theme))
					return "error: invalid theme";

				ThemeStorage.Increment(theme);
				return "ok";
			}
			catch (Exception ex)
			{
				return "error: " + ex.Message;
			}
		}

		// Development-only login method for session testing
		#if DEBUG
		[WebMethod(EnableSession = true)]
		public string DevLogin(string role)
		{
			if (string.IsNullOrWhiteSpace(role)) return "error: invalid role";
			Session["role"] = role.ToLowerInvariant();
			return "ok";
		}
		#endif

		// Normalize role names to standard values
		private string NormalizeRole(string rawRole)
		{
			if (string.IsNullOrWhiteSpace(rawRole))
				return string.Empty;

			var role = rawRole.Trim().ToLowerInvariant();

			if (role == "admin" || role == "administrator" || role == "manager")
				return "admin";

			if (role == "employer" || role == "owner")
				return "employer";

			if (role == "user" || role == "employee")
				return "user";

			return role;
		}

		// Aggregated report endpoint with access control
		[WebMethod(EnableSession = true)]
		[System.Web.Script.Services.ScriptMethod(ResponseFormat = ResponseFormat.Json)]
		public AggregatedReportDto GetAggregatedReport()
		{
			try
			{
				var roleObj = Session["role"];

				if (roleObj == null)
				{
					Context.Response.StatusCode = 401;
					return new AggregatedReportDto
					{
						TotalCount = 0,
						CountsPerTheme = new CountItem[0],
						CountsPerDay = new CountItem[0]
					};
				}

				var normalizedRole = NormalizeRole(roleObj.ToString());

				if (normalizedRole != "admin" && normalizedRole != "employer")
				{
					Context.Response.StatusCode = 403;
					return new AggregatedReportDto
					{
						TotalCount = 0,
						CountsPerTheme = new CountItem[0],
						CountsPerDay = new CountItem[0]
					};
				}

				var allFeedback = FeedbackStorage.GetAll() ?? new List<Feedback>();
				int totalCount = allFeedback.Count;

				var countsPerTheme = allFeedback
					.GroupBy(f => string.IsNullOrWhiteSpace(f.Theme) ? "Unknown" : f.Theme.Trim())
					.Select(g => new CountItem(g.Key, g.Count()))
					.ToArray();

				var countsPerDay = allFeedback
					.GroupBy(f => f.CreatedAt.ToUniversalTime().ToString("yyyy-MM-dd"))
					.Select(g => new CountItem(g.Key, g.Count()))
					.ToArray();

				return new AggregatedReportDto
				{
					TotalCount = totalCount,
					CountsPerTheme = countsPerTheme,
					CountsPerDay = countsPerDay
				};
			}
			catch
			{
				Context.Response.StatusCode = 500;
				return new AggregatedReportDto
				{
					TotalCount = 0,
					CountsPerTheme = new CountItem[0],
					CountsPerDay = new CountItem[0]
				};
			}
		}
	}
}