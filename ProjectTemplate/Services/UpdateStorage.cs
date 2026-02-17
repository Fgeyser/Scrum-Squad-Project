using System;
using System.Collections.Generic;
using System.IO;
using System.Web;
using Newtonsoft.Json;
using ProjectTemplate.Models;

namespace ProjectTemplate.Services
{
    public static class UpdateStorage
    {
        private static readonly string DataFile = HttpContext.Current.Server.MapPath("~/App_Data/updates.json");

        public static void Save(Update item)
        {
            List<Update> list;
            if (!File.Exists(DataFile))
            {
                list = new List<Update>();
            }
            else
            {
                var json = File.ReadAllText(DataFile);
                list = JsonConvert.DeserializeObject<List<Update>>(json) ?? new List<Update>();
            }
            list.Add(item);
            File.WriteAllText(DataFile, JsonConvert.SerializeObject(list, Formatting.Indented));
        }

        public static List<Update> GetAll()
        {
            if (!File.Exists(DataFile)) return new List<Update>();
            var json = File.ReadAllText(DataFile);
            return JsonConvert.DeserializeObject<List<Update>>(json) ?? new List<Update>();
        }

        public static List<Update> GetByPostId(string postId)
        {
            var all = GetAll();
            return all.FindAll(u => u.PostId == postId);
        }
    }
}
